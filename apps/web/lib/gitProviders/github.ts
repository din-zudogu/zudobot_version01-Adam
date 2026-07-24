import { Octokit } from "@octokit/rest";
import type {
  GitConnectionCredentials,
  GitProviderClient,
  ReadFileResult,
  RepoSummary,
  RepoTreeEntry,
} from "./types";

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", "vendor"]);
const MAX_TREE_ENTRIES = 200;

function splitRepo(repo: string): { owner: string; repoName: string } {
  const [owner, repoName] = repo.split("/");
  if (!owner || !repoName) throw new Error(`invalid_repo_identifier: "${repo}" (expected "owner/repo")`);
  return { owner, repoName };
}

export class GitHubProviderClient implements GitProviderClient {
  readonly provider = "github" as const;
  private octokit: Octokit;

  constructor(creds: GitConnectionCredentials) {
    if (!creds.accessToken) throw new Error("github_missing_access_token");
    this.octokit = new Octokit({ auth: creds.accessToken });
  }

  async listRepositories(): Promise<RepoSummary[]> {
    const { data } = await this.octokit.repos.listForAuthenticatedUser({
      per_page: 100,
      sort: "updated",
    });
    return data.map((r) => ({
      id: String(r.id),
      name: r.name,
      fullName: r.full_name,
      defaultBranch: r.default_branch ?? "main",
      private: r.private,
      url: r.html_url,
    }));
  }

  async listTree(repo: string, ref: string, path = ""): Promise<RepoTreeEntry[]> {
    const { owner, repoName } = splitRepo(repo);
    const { data } = await this.octokit.repos.getContent({ owner, repo: repoName, path, ref });
    const entries = Array.isArray(data) ? data : [data];
    return entries
      .filter((e) => !SKIP_DIRS.has(e.name))
      .slice(0, MAX_TREE_ENTRIES)
      .map((e) => ({ path: e.path, type: e.type === "dir" ? "dir" : "file" }));
  }

  async readFile(repo: string, ref: string, path: string): Promise<ReadFileResult> {
    const { owner, repoName } = splitRepo(repo);
    const { data } = await this.octokit.repos.getContent({ owner, repo: repoName, path, ref });
    if (Array.isArray(data) || data.type !== "file" || !("content" in data)) {
      throw new Error(`not_a_file: ${path}`);
    }
    return {
      content: Buffer.from(data.content, "base64").toString("utf8"),
      sha: data.sha,
    };
  }

  async createBranch(repo: string, fromRef: string, newBranch: string): Promise<void> {
    const { owner, repoName } = splitRepo(repo);
    const { data: baseRef } = await this.octokit.git.getRef({
      owner,
      repo: repoName,
      ref: `heads/${fromRef}`,
    });
    await this.octokit.git.createRef({
      owner,
      repo: repoName,
      ref: `refs/heads/${newBranch}`,
      sha: baseRef.object.sha,
    });
  }

  async commitFile(
    repo: string,
    branch: string,
    path: string,
    content: string,
    message: string
  ): Promise<{ commitSha: string }> {
    const { owner, repoName } = splitRepo(repo);

    // Need the current file's sha (if it already exists on this branch) to
    // update it — GitHub's Contents API rejects an update without it.
    let existingSha: string | undefined;
    try {
      const existing = await this.readFile(repo, branch, path);
      existingSha = existing.sha;
    } catch {
      // File doesn't exist yet on this branch — plain create, no sha needed.
    }

    const { data } = await this.octokit.repos.createOrUpdateFileContents({
      owner,
      repo: repoName,
      path,
      message,
      content: Buffer.from(content, "utf8").toString("base64"),
      branch,
      sha: existingSha,
    });
    return { commitSha: data.commit.sha ?? "" };
  }

  async openPullRequest(
    repo: string,
    sourceBranch: string,
    targetBranch: string,
    title: string,
    body: string
  ): Promise<{ id: string; url: string }> {
    const { owner, repoName } = splitRepo(repo);
    const { data } = await this.octokit.pulls.create({
      owner,
      repo: repoName,
      head: sourceBranch,
      base: targetBranch,
      title,
      body,
    });
    return { id: String(data.number), url: data.html_url };
  }

  async mergePullRequest(repo: string, pullRequestId: string): Promise<void> {
    const { owner, repoName } = splitRepo(repo);
    await this.octokit.pulls.merge({
      owner,
      repo: repoName,
      pull_number: Number(pullRequestId),
    });
  }
}
