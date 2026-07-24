import { AMPLIFY_CONFIG } from "@/lib/env/amplifyGuardrail";

export type OAuthGitProvider = "github" | "gitlab" | "bitbucket";

export interface GitOAuthProviderConfig {
  authorizeUrl: string;
  tokenUrl: string;
  scope: string;
  identityUrl: string;
  clientId: string;
  clientSecret: string;
  /** Extract a human-readable account label from the identity endpoint's response body. */
  parseIdentity: (body: unknown) => string;
}

function asRecord(body: unknown): Record<string, unknown> {
  return typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
}

export function getGitOAuthProviderConfig(provider: OAuthGitProvider): GitOAuthProviderConfig {
  switch (provider) {
    case "github":
      return {
        authorizeUrl: "https://github.com/login/oauth/authorize",
        tokenUrl: "https://github.com/login/oauth/access_token",
        scope: "repo",
        identityUrl: "https://api.github.com/user",
        clientId: AMPLIFY_CONFIG.githubClientId,
        clientSecret: AMPLIFY_CONFIG.githubClientSecret,
        parseIdentity: (body) => String(asRecord(body).login ?? "github"),
      };
    case "gitlab":
      return {
        authorizeUrl: "https://gitlab.com/oauth/authorize",
        tokenUrl: "https://gitlab.com/oauth/token",
        scope: "api",
        identityUrl: "https://gitlab.com/api/v4/user",
        clientId: AMPLIFY_CONFIG.gitlabClientId,
        clientSecret: AMPLIFY_CONFIG.gitlabClientSecret,
        parseIdentity: (body) => String(asRecord(body).username ?? "gitlab"),
      };
    case "bitbucket":
      return {
        authorizeUrl: "https://bitbucket.org/site/oauth2/authorize",
        tokenUrl: "https://bitbucket.org/site/oauth2/access_token",
        scope: "repository:write pullrequest:write account:read",
        identityUrl: "https://api.bitbucket.org/2.0/user",
        clientId: AMPLIFY_CONFIG.bitbucketClientId,
        clientSecret: AMPLIFY_CONFIG.bitbucketClientSecret,
        parseIdentity: (body) => String(asRecord(body).username ?? "bitbucket"),
      };
  }
}

export function isOAuthGitProvider(value: string): value is OAuthGitProvider {
  return value === "github" || value === "gitlab" || value === "bitbucket";
}
