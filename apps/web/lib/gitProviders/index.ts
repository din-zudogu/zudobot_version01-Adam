import { decryptGitToken } from "@/lib/integration/gitTokenCrypto";
import { GitHubProviderClient } from "./github";
import { GitLabProviderClient } from "./gitlab";
import { BitbucketProviderClient } from "./bitbucket";
import { CodeCommitProviderClient } from "./codecommit";
import type { GitConnectionCredentials, GitProviderClient, GitProviderName } from "./types";

export * from "./types";

/** Minimal shape needed from a `gitConnections` row — decouples this factory
 *  from the exact Drizzle row type so callers can pass either a full row or
 *  a test fixture. */
export interface GitConnectionRow {
  provider: string;
  authMethod: string;
  accessTokenEnc: string | null;
  refreshTokenEnc: string | null;
  iamAccessKeyIdEnc: string | null;
  awsRegion: string | null;
  roleArn?: string | null;
  externalIdEnc?: string | null;
}

function decryptConnection(row: GitConnectionRow): GitConnectionCredentials {
  return {
    provider: row.provider as GitProviderName,
    authMethod: row.authMethod as "oauth" | "iam_keys" | "iam_role",
    accessToken: row.accessTokenEnc ? decryptGitToken(row.accessTokenEnc) : undefined,
    refreshToken: row.refreshTokenEnc ? decryptGitToken(row.refreshTokenEnc) : undefined,
    iamAccessKeyId: row.iamAccessKeyIdEnc ? decryptGitToken(row.iamAccessKeyIdEnc) : undefined,
    awsRegion: row.awsRegion ?? undefined,
    roleArn: row.roleArn ?? undefined,
    externalId: row.externalIdEnc ? decryptGitToken(row.externalIdEnc) : undefined,
  };
}

/** Instantiate the right GitProviderClient for a connection row, decrypting
 *  its stored credentials. Both the Claude agent's tools and the "go live"
 *  merge route call through this — never construct a provider client
 *  directly elsewhere. */
export function getGitProviderClient(row: GitConnectionRow): GitProviderClient {
  const creds = decryptConnection(row);
  switch (creds.provider) {
    case "github":
      return new GitHubProviderClient(creds);
    case "gitlab":
      return new GitLabProviderClient(creds);
    case "bitbucket":
      return new BitbucketProviderClient(creds);
    case "codecommit":
      return new CodeCommitProviderClient(creds);
    default:
      throw new Error(`unsupported_git_provider: ${creds.provider}`);
  }
}
