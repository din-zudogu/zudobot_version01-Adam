export type GitProviderName = "github" | "gitlab" | "bitbucket" | "codecommit";

export interface RepoTreeEntry {
  path: string;
  type: "file" | "dir";
}

export interface RepoSummary {
  id: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  private: boolean;
  url: string;
}

export interface ReadFileResult {
  content: string;
  /** Provider's current blob/file identifier — required by some providers'
   *  update-file APIs (e.g. GitHub) to prove you're not overwriting a
   *  concurrent change. Undefined for providers that don't need it. */
  sha?: string;
}

/**
 * Uniform surface over GitHub/GitLab/Bitbucket/AWS CodeCommit, used by both
 * the Claude agent's tools (list/read/commit only — never merge) and the
 * "go live" route (merge only). Implementations talk to each provider's
 * REST/SDK API directly — no local git clone, so everything stays within a
 * serverless function's time/memory budget.
 */
export interface GitProviderClient {
  readonly provider: GitProviderName;

  listRepositories(): Promise<RepoSummary[]>;

  listTree(repo: string, ref: string, path?: string): Promise<RepoTreeEntry[]>;

  readFile(repo: string, ref: string, path: string): Promise<ReadFileResult>;

  createBranch(repo: string, fromRef: string, newBranch: string): Promise<void>;

  commitFile(
    repo: string,
    branch: string,
    path: string,
    content: string,
    message: string
  ): Promise<{ commitSha: string }>;

  openPullRequest(
    repo: string,
    sourceBranch: string,
    targetBranch: string,
    title: string,
    body: string
  ): Promise<{ id: string; url: string }>;

  /** Never called by the Claude agent — only by the explicit "go live" route. */
  mergePullRequest(repo: string, pullRequestId: string): Promise<void>;
}

/** Shape of a decrypted gitConnections row, as passed to the provider factory. */
export interface GitConnectionCredentials {
  provider: GitProviderName;
  authMethod: "oauth" | "iam_keys" | "iam_role";
  accessToken?: string;      // OAuth access token, or CodeCommit IAM secret key (authMethod 'iam_keys')
  refreshToken?: string;
  iamAccessKeyId?: string;   // CodeCommit 'iam_keys' only
  awsRegion?: string;        // CodeCommit only (both auth methods)
  roleArn?: string;          // CodeCommit 'iam_role' only — cross-account AssumeRole target
  externalId?: string;       // CodeCommit 'iam_role' only — sts:ExternalId condition
}
