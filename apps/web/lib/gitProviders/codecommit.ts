import {
  CodeCommitClient,
  GetFolderCommand,
  GetFileCommand,
  GetBranchCommand,
  CreateBranchCommand,
  CreateCommitCommand,
  CreatePullRequestCommand,
  MergePullRequestByFastForwardCommand,
  ListRepositoriesCommand,
  GetRepositoryCommand,
} from "@aws-sdk/client-codecommit";
import { fromTemporaryCredentials } from "@aws-sdk/credential-providers";
import type {
  GitConnectionCredentials,
  GitProviderClient,
  ReadFileResult,
  RepoSummary,
  RepoTreeEntry,
} from "./types";

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", "vendor"]);
const MAX_TREE_ENTRIES = 200;

// CodeCommit's identity model differs from the other three providers: repos
// are flat names (no owner/workspace prefix), its PR object isn't scoped to
// a single repo string the same way (a PR's `targets` array carries the
// repository name itself — why mergePullRequest() below needs the repo param
// passed explicitly even though CreatePullRequest already encodes it in
// `targets`), and it supports two distinct auth methods:
//   - 'iam_keys' — customer-pasted static AWS access/secret key (legacy path,
//     kept for customers who already connected this way).
//   - 'iam_role' — cross-account AssumeRole via a CloudFormation-created Role
//     + ExternalId (see apps/web/public/cloudformation/zudobot-codecommit-access.yaml).
//     No long-lived customer secret is ever stored for this method.
//     fromTemporaryCredentials() with no `masterCredentials` uses the AWS SDK's
//     default credential provider chain for the *calling* side (i.e. this
//     server's own Amplify Compute execution role) to perform the AssumeRole
//     call — no static Zudobot-side secret key needed either, as long as that
//     execution role is granted sts:AssumeRole in IAM (an infra-side setup
//     step, not something this code can do).
export class CodeCommitProviderClient implements GitProviderClient {
  readonly provider = "codecommit" as const;
  private client: CodeCommitClient;

  constructor(creds: GitConnectionCredentials) {
    if (!creds.awsRegion) throw new Error("codecommit_missing_credentials");

    if (creds.authMethod === "iam_role") {
      if (!creds.roleArn || !creds.externalId) throw new Error("codecommit_missing_credentials");
      this.client = new CodeCommitClient({
        region: creds.awsRegion,
        credentials: fromTemporaryCredentials({
          params: {
            RoleArn: creds.roleArn,
            ExternalId: creds.externalId,
            RoleSessionName: "zudobot-agent",
          },
        }),
      });
      return;
    }

    if (!creds.accessToken || !creds.iamAccessKeyId) throw new Error("codecommit_missing_credentials");
    this.client = new CodeCommitClient({
      region: creds.awsRegion,
      credentials: { accessKeyId: creds.iamAccessKeyId, secretAccessKey: creds.accessToken },
    });
  }

  async listRepositories(): Promise<RepoSummary[]> {
    const list = await this.client.send(new ListRepositoriesCommand({}));
    const repos = list.repositories ?? [];
    const summaries: RepoSummary[] = [];
    for (const r of repos) {
      if (!r.repositoryName) continue;
      const detail = await this.client.send(new GetRepositoryCommand({ repositoryName: r.repositoryName }));
      const meta = detail.repositoryMetadata;
      summaries.push({
        id: r.repositoryId ?? r.repositoryName,
        name: r.repositoryName,
        fullName: r.repositoryName,
        defaultBranch: meta?.defaultBranch ?? "main",
        private: true, // CodeCommit repos are always private to the AWS account
        url: meta?.cloneUrlHttp ?? "",
      });
    }
    return summaries;
  }

  async listTree(repo: string, ref: string, path = ""): Promise<RepoTreeEntry[]> {
    const res = await this.client.send(
      new GetFolderCommand({ repositoryName: repo, folderPath: path || "/", commitSpecifier: ref })
    );
    const files = (res.files ?? []).map((f) => ({ path: f.absolutePath ?? "", type: "file" as const }));
    const dirs = (res.subFolders ?? []).map((d) => ({ path: d.absolutePath ?? "", type: "dir" as const }));
    return [...dirs, ...files]
      .filter((e) => e.path && !SKIP_DIRS.has(e.path.split("/").pop() ?? ""))
      .slice(0, MAX_TREE_ENTRIES);
  }

  async readFile(repo: string, ref: string, path: string): Promise<ReadFileResult> {
    const res = await this.client.send(
      new GetFileCommand({ repositoryName: repo, filePath: path, commitSpecifier: ref })
    );
    return { content: Buffer.from(res.fileContent ?? new Uint8Array()).toString("utf8") };
  }

  async createBranch(repo: string, fromRef: string, newBranch: string): Promise<void> {
    const base = await this.client.send(new GetBranchCommand({ repositoryName: repo, branchName: fromRef }));
    const commitId = base.branch?.commitId;
    if (!commitId) throw new Error(`codecommit_branch_not_found: ${fromRef}`);
    await this.client.send(
      new CreateBranchCommand({ repositoryName: repo, branchName: newBranch, commitId })
    );
  }

  async commitFile(
    repo: string,
    branch: string,
    path: string,
    content: string,
    message: string
  ): Promise<{ commitSha: string }> {
    const head = await this.client.send(new GetBranchCommand({ repositoryName: repo, branchName: branch }));
    const parentCommitId = head.branch?.commitId;
    if (!parentCommitId) throw new Error(`codecommit_branch_not_found: ${branch}`);

    const res = await this.client.send(
      new CreateCommitCommand({
        repositoryName: repo,
        branchName: branch,
        parentCommitId,
        commitMessage: message,
        putFiles: [{ filePath: path, fileContent: Buffer.from(content, "utf8") }],
      })
    );
    return { commitSha: res.commitId ?? "" };
  }

  async openPullRequest(
    repo: string,
    sourceBranch: string,
    targetBranch: string,
    title: string,
    body: string
  ): Promise<{ id: string; url: string }> {
    const res = await this.client.send(
      new CreatePullRequestCommand({
        title,
        description: body,
        targets: [{ repositoryName: repo, sourceReference: sourceBranch, destinationReference: targetBranch }],
      })
    );
    const id = res.pullRequest?.pullRequestId ?? "";
    // CodeCommit has no public web PR URL format outside the AWS Console —
    // build a best-effort console deep link (region taken from the client config).
    return { id, url: "" };
  }

  async mergePullRequest(repo: string, pullRequestId: string): Promise<void> {
    await this.client.send(
      new MergePullRequestByFastForwardCommand({ pullRequestId, repositoryName: repo })
    );
  }
}
