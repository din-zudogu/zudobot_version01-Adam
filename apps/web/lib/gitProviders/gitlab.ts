import { Gitlab } from "@gitbeaker/rest";
import type {
  GitConnectionCredentials,
  GitProviderClient,
  ReadFileResult,
  RepoSummary,
  RepoTreeEntry,
} from "./types";

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", "vendor"]);
const MAX_TREE_ENTRIES = 200;

// GitLab project identifiers can be numeric IDs or URL-encoded paths
// ("group/subgroup/project") — the stored repoIdentifier is the path form,
// @gitbeaker accepts either directly as `projectId`.

export class GitLabProviderClient implements GitProviderClient {
  readonly provider = "gitlab" as const;
  private api: InstanceType<typeof Gitlab>;

  constructor(creds: GitConnectionCredentials) {
    if (!creds.accessToken) throw new Error("gitlab_missing_access_token");
    this.api = new Gitlab({ oauthToken: creds.accessToken });
  }

  async listRepositories(): Promise<RepoSummary[]> {
    const projects = await this.api.Projects.all({
      membership: true,
      perPage: 100,
      orderBy: "last_activity_at",
      sort: "desc",
    });
    return projects.map((p) => {
      const rec = p as unknown as Record<string, unknown>;
      return {
        id: String(rec.id),
        name: String(rec.name),
        fullName: String(rec.path_with_namespace ?? rec.pathWithNamespace ?? rec.name),
        defaultBranch: String(rec.default_branch ?? rec.defaultBranch ?? "main"),
        private: rec.visibility !== "public",
        url: String(rec.web_url ?? rec.webUrl ?? ""),
      };
    });
  }

  async listTree(repo: string, ref: string, path = ""): Promise<RepoTreeEntry[]> {
    const entries = await this.api.Repositories.allRepositoryTrees(repo, { path, ref, perPage: MAX_TREE_ENTRIES });
    return entries
      .filter((e: { name: string }) => !SKIP_DIRS.has(e.name))
      .map((e: { path: string; type: string }) => ({
        path: e.path,
        type: e.type === "tree" ? ("dir" as const) : ("file" as const),
      }));
  }

  async readFile(repo: string, ref: string, path: string): Promise<ReadFileResult> {
    const file = await this.api.RepositoryFiles.show(repo, path, ref);
    return { content: Buffer.from(file.content, "base64").toString("utf8") };
  }

  async createBranch(repo: string, fromRef: string, newBranch: string): Promise<void> {
    await this.api.Branches.create(repo, newBranch, fromRef);
  }

  async commitFile(
    repo: string,
    branch: string,
    path: string,
    content: string,
    message: string
  ): Promise<{ commitSha: string }> {
    // GitLab's file API needs to know create-vs-update up front.
    let exists = true;
    try {
      await this.api.RepositoryFiles.show(repo, path, branch);
    } catch {
      exists = false;
    }

    const commit = exists
      ? await this.api.RepositoryFiles.edit(repo, path, branch, content, message)
      : await this.api.RepositoryFiles.create(repo, path, branch, content, message);
    return { commitSha: (commit as { commit_id?: string; commitId?: string }).commit_id ?? (commit as { commitId?: string }).commitId ?? "" };
  }

  async openPullRequest(
    repo: string,
    sourceBranch: string,
    targetBranch: string,
    title: string,
    body: string
  ): Promise<{ id: string; url: string }> {
    const mr = await this.api.MergeRequests.create(repo, sourceBranch, targetBranch, title, { description: body });
    const rec = mr as unknown as Record<string, unknown>;
    return { id: String(rec.iid), url: String(rec.web_url ?? rec.webUrl ?? "") };
  }

  async mergePullRequest(repo: string, pullRequestId: string): Promise<void> {
    await this.api.MergeRequests.accept(repo, Number(pullRequestId));
  }
}
