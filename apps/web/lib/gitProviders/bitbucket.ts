import type {
  GitConnectionCredentials,
  GitProviderClient,
  ReadFileResult,
  RepoSummary,
  RepoTreeEntry,
} from "./types";

// Bitbucket Cloud REST API v2.0 — no mature official SDK, plain fetch.
// NOTE: file writes use a different (multipart/form-data) shape than the
// JSON-based content APIs GitHub/GitLab use — see commitFile() below.

const API_BASE = "https://api.bitbucket.org/2.0";
const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", "vendor"]);
const MAX_TREE_ENTRIES = 200;

function splitRepo(repo: string): { workspace: string; repoSlug: string } {
  const [workspace, repoSlug] = repo.split("/");
  if (!workspace || !repoSlug) throw new Error(`invalid_repo_identifier: "${repo}" (expected "workspace/repo_slug")`);
  return { workspace, repoSlug };
}

interface BitbucketTreeEntry {
  path: string;
  type: "commit_file" | "commit_directory";
}
interface BitbucketPage<T> {
  values: T[];
  next?: string;
}

export class BitbucketProviderClient implements GitProviderClient {
  readonly provider = "bitbucket" as const;
  private token: string;

  constructor(creds: GitConnectionCredentials) {
    if (!creds.accessToken) throw new Error("bitbucket_missing_access_token");
    this.token = creds.accessToken;
  }

  private async req(path: string, init?: RequestInit): Promise<Response> {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${this.token}`, ...(init?.headers ?? {}) },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`bitbucket_api_error: ${res.status} ${path} — ${body.slice(0, 300)}`);
    }
    return res;
  }

  async listRepositories(): Promise<RepoSummary[]> {
    const res = await this.req(`/user/permissions/repositories?pagelen=100`);
    const data = (await res.json()) as BitbucketPage<{
      repository: { uuid: string; name: string; full_name: string; is_private: boolean; links: { html: { href: string } }; mainbranch?: { name: string } };
    }>;
    return data.values.map((v) => ({
      id: v.repository.uuid,
      name: v.repository.name,
      fullName: v.repository.full_name,
      defaultBranch: v.repository.mainbranch?.name ?? "main",
      private: v.repository.is_private,
      url: v.repository.links.html.href,
    }));
  }

  async listTree(repo: string, ref: string, path = ""): Promise<RepoTreeEntry[]> {
    const { workspace, repoSlug } = splitRepo(repo);
    const res = await this.req(
      `/repositories/${workspace}/${repoSlug}/src/${encodeURIComponent(ref)}/${path}?pagelen=${MAX_TREE_ENTRIES}`
    );
    const data = (await res.json()) as BitbucketPage<BitbucketTreeEntry>;
    return data.values
      .map((e) => ({ path: e.path, type: e.type === "commit_directory" ? ("dir" as const) : ("file" as const) }))
      .filter((e) => !SKIP_DIRS.has(e.path.split("/").pop() ?? ""));
  }

  async readFile(repo: string, ref: string, path: string): Promise<ReadFileResult> {
    const { workspace, repoSlug } = splitRepo(repo);
    const res = await this.req(`/repositories/${workspace}/${repoSlug}/src/${encodeURIComponent(ref)}/${path}`);
    return { content: await res.text() };
  }

  async createBranch(repo: string, fromRef: string, newBranch: string): Promise<void> {
    const { workspace, repoSlug } = splitRepo(repo);
    const branchRes = await this.req(`/repositories/${workspace}/${repoSlug}/refs/branches/${encodeURIComponent(fromRef)}`);
    const branchData = (await branchRes.json()) as { target: { hash: string } };
    await this.req(`/repositories/${workspace}/${repoSlug}/refs/branches`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newBranch, target: { hash: branchData.target.hash } }),
    });
  }

  async commitFile(
    repo: string,
    branch: string,
    path: string,
    content: string,
    message: string
  ): Promise<{ commitSha: string }> {
    const { workspace, repoSlug } = splitRepo(repo);
    // Bitbucket has no JSON "create/update file" endpoint — writes go through
    // a multipart/form-data commit: one form field per file path, plus
    // branch/message. This is structurally different from GitHub/GitLab.
    const form = new FormData();
    form.append(path, content);
    form.append("branch", branch);
    form.append("message", message);

    await this.req(`/repositories/${workspace}/${repoSlug}/src`, { method: "POST", body: form });

    const branchRes = await this.req(`/repositories/${workspace}/${repoSlug}/refs/branches/${encodeURIComponent(branch)}`);
    const branchData = (await branchRes.json()) as { target: { hash: string } };
    return { commitSha: branchData.target.hash };
  }

  async openPullRequest(
    repo: string,
    sourceBranch: string,
    targetBranch: string,
    title: string,
    body: string
  ): Promise<{ id: string; url: string }> {
    const { workspace, repoSlug } = splitRepo(repo);
    const res = await this.req(`/repositories/${workspace}/${repoSlug}/pullrequests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description: body,
        source: { branch: { name: sourceBranch } },
        destination: { branch: { name: targetBranch } },
      }),
    });
    const data = (await res.json()) as { id: number; links: { html: { href: string } } };
    return { id: String(data.id), url: data.links.html.href };
  }

  async mergePullRequest(repo: string, pullRequestId: string): Promise<void> {
    const { workspace, repoSlug } = splitRepo(repo);
    await this.req(`/repositories/${workspace}/${repoSlug}/pullrequests/${pullRequestId}/merge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ merge_strategy: "merge_commit" }),
    });
  }
}
