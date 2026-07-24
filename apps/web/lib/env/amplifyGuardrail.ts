// ==========================================
// 🛡️ AMPLIFY RUNTIME ENVIRONMENT GUARDRAIL
// ==========================================
// Secrets/config must come from AWS Amplify Console → process.env only.
// No dotenv. No local .env files. No fallback strings for missing secrets.

const REQUIRED_AMPLIFY_ENV_VARS = [
  "MONGO_URI",
  "AUTH_SECRET",
  "AUTH_URL",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
] as const;

/** At least one non-empty value per group (e.g. primary or live Gemini key). */
const REQUIRED_ONE_OF_GROUPS: readonly (readonly string[])[] = [
  ["GEMINI_API_KEY", "GEMINI_API_KEY_LIVE"],
];

let validated = false;

// Static process.env.X accesses (NOT a dynamic process.env[name] lookup) so
// Next.js's build-time env inlining (next.config.mjs `env` key) can actually
// substitute these — a bundler can only pattern-match a literal member
// expression, never a runtime variable. This is what makes these values
// survive on Amplify Hosting Compute, where the deployed Lambda's runtime
// process.env does NOT carry the Console-configured vars (build time only).
const STATIC_ENV_SNAPSHOT: Record<string, string | undefined> = {
  MONGO_URI:             process.env.MONGO_URI,
  MONGO_URI_DIRECT:      process.env.MONGO_URI_DIRECT,
  AUTH_SECRET:           process.env.AUTH_SECRET,
  AUTH_URL:              process.env.AUTH_URL,
  GOOGLE_CLIENT_ID:      process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET:  process.env.GOOGLE_CLIENT_SECRET,
  GEMINI_API_KEY:        process.env.GEMINI_API_KEY,
  GEMINI_API_KEY_LIVE:   process.env.GEMINI_API_KEY_LIVE,
  INTERNAL_CRON_SECRET:  process.env.INTERNAL_CRON_SECRET,
  WEBHOOK_SECRET:        process.env.WEBHOOK_SECRET,
  DATABASE_URL:          process.env.DATABASE_URL,
  DIRECT_URL:            process.env.DIRECT_URL,
  MAIL_PROVIDER:         process.env.MAIL_PROVIDER,
  MAIL_API_KEY:          process.env.MAIL_API_KEY,
  MAIL_FROM:             process.env.MAIL_FROM,
  // ── Git-connect auto-install — optional, feature-scoped (see AMPLIFY_CONFIG below) ──
  GITHUB_CLIENT_ID:               process.env.GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET:           process.env.GITHUB_CLIENT_SECRET,
  GITLAB_CLIENT_ID:               process.env.GITLAB_CLIENT_ID,
  GITLAB_CLIENT_SECRET:           process.env.GITLAB_CLIENT_SECRET,
  BITBUCKET_CLIENT_ID:            process.env.BITBUCKET_CLIENT_ID,
  BITBUCKET_CLIENT_SECRET:        process.env.BITBUCKET_CLIENT_SECRET,
  ANTHROPIC_API_KEY:              process.env.ANTHROPIC_API_KEY,
  GIT_OAUTH_TOKEN_ENCRYPTION_KEY: process.env.GIT_OAUTH_TOKEN_ENCRYPTION_KEY,
  // Zudobot's own AWS account — the trusted principal in the CloudFormation
  // Quick-Create template customers launch to grant CodeCommit cross-account
  // access (no long-lived customer secret keys involved for this path).
  ZUDOBOT_AWS_ACCOUNT_ID:         process.env.ZUDOBOT_AWS_ACCOUNT_ID,
};

function readEnv(name: string): string | undefined {
  const value = STATIC_ENV_SNAPSHOT[name];
  if (value === undefined || value === null) return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function assertRequired(name: string): string {
  const value = readEnv(name);
  if (!value) {
    throw new Error(
      `CRITICAL SECURITY EXCEPTION: AWS Amplify Environment Variable [${name}] is missing or empty! System aborted for production safety.`
    );
  }
  return value;
}

function assertOneOf(names: readonly string[]): string {
  for (const name of names) {
    const value = readEnv(name);
    if (value) return value;
  }
  throw new Error(
    `CRITICAL SECURITY EXCEPTION: AWS Amplify requires one of [${names.join(", ")}] to be set and non-empty! System aborted for production safety.`
  );
}

/** Enforce Amplify env presence (idempotent). */
export function validateAmplifyEnvironment(): void {
  if (validated) return;

  for (const envVar of REQUIRED_AMPLIFY_ENV_VARS) {
    assertRequired(envVar);
  }

  for (const group of REQUIRED_ONE_OF_GROUPS) {
    assertOneOf(group);
  }

  validated = true;
}

/** Read a required Amplify env var after validation (no fallback). */
export function requireAmplifyEnv(name: string): string {
  validateAmplifyEnvironment();
  return assertRequired(name);
}

/** Gemini API key — primary or live slot from Amplify. */
export function requireGeminiApiKey(): string {
  validateAmplifyEnvironment();
  return assertOneOf(["GEMINI_API_KEY", "GEMINI_API_KEY_LIVE"]);
}

// Populated after validateAmplifyEnvironment() — no secret fallbacks
export const AMPLIFY_CONFIG = {
  get mongoUri() {
    return requireAmplifyEnv("MONGO_URI");
  },
  get mongoUriDirect() {
    return readEnv("MONGO_URI_DIRECT");
  },
  get authSecret() {
    return requireAmplifyEnv("AUTH_SECRET");
  },
  get authUrl() {
    return requireAmplifyEnv("AUTH_URL");
  },
  get googleClientId() {
    return requireAmplifyEnv("GOOGLE_CLIENT_ID");
  },
  get googleClientSecret() {
    return requireAmplifyEnv("GOOGLE_CLIENT_SECRET");
  },
  get geminiApiKey() {
    return requireGeminiApiKey();
  },
  get internalCronSecret() {
    return readEnv("INTERNAL_CRON_SECRET");
  },
  get webhookSecret() {
    return readEnv("WEBHOOK_SECRET");
  },
  // ── PostgreSQL (Neon) — new features only, MongoDB stays canonical for
  // existing models. Optional: features that need Postgres should check
  // this is set rather than crashing the whole app if it's absent.
  get databaseUrl() {
    return readEnv("DATABASE_URL");
  },
  get databaseUrlDirect() {
    return readEnv("DIRECT_URL");
  },
  // ── Outbound email (receipts) ──────────────────────────────────────
  get mailProvider() {
    return readEnv("MAIL_PROVIDER"); // e.g. "resend" | "ses" | "sendgrid"
  },
  get mailApiKey() {
    return readEnv("MAIL_API_KEY");
  },
  get mailFrom() {
    return readEnv("MAIL_FROM"); // e.g. "Zudobot <noreply@zudogu.com>"
  },
  // ── Git-connect auto-install (GitHub/GitLab/Bitbucket OAuth + Claude
  // agent) — optional app-wide: only the specific route/service that needs
  // one of these throws when it's actually accessed and missing, so an
  // unconfigured provider doesn't block tenants using the others. Callers
  // must wrap access in try/catch and return 503 { error: "integration_not_configured" }.
  get githubClientId() {
    return requireAmplifyEnv("GITHUB_CLIENT_ID");
  },
  get githubClientSecret() {
    return requireAmplifyEnv("GITHUB_CLIENT_SECRET");
  },
  get gitlabClientId() {
    return requireAmplifyEnv("GITLAB_CLIENT_ID");
  },
  get gitlabClientSecret() {
    return requireAmplifyEnv("GITLAB_CLIENT_SECRET");
  },
  get bitbucketClientId() {
    return requireAmplifyEnv("BITBUCKET_CLIENT_ID");
  },
  get bitbucketClientSecret() {
    return requireAmplifyEnv("BITBUCKET_CLIENT_SECRET");
  },
  get anthropicApiKey() {
    return requireAmplifyEnv("ANTHROPIC_API_KEY");
  },
  // 64 hex chars (32 bytes) — AES-256-GCM key, dedicated (not PII_ENCRYPTION_KEY)
  // to limit blast radius if one key ever leaks.
  get gitOAuthTokenEncryptionKey() {
    return requireAmplifyEnv("GIT_OAUTH_TOKEN_ENCRYPTION_KEY");
  },
  get zudobotAwsAccountId() {
    return requireAmplifyEnv("ZUDOBOT_AWS_ACCOUNT_ID");
  },
};
