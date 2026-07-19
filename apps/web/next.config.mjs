// Amplify Hosting Compute only exposes Console env vars at build time — not to
// the deployed Lambda's runtime process.env (confirmed via CloudWatch: the
// instrumentation hook crashed with "MONGO_URI is missing" at cold start even
// though build-time checks saw it fine). Writing these into apps/web/.env.production
// during the Amplify build (see amplify.yml) was the officially documented AWS
// workaround, but didn't survive whatever Amplify does when repackaging the
// Next.js standalone output into the actual Lambda bundle.
//
// This `env` block is a more robust fallback: Next.js replaces every
// `process.env.X` reference for these names with the literal build-time value
// directly in the compiled bundle (same mechanism NEXT_PUBLIC_ vars use,
// just not restricted to that prefix) — so the value survives regardless of
// what happens to loose files during deployment packaging. Keep this list in
// sync with amplify.yml's env-passthrough list and amplifyGuardrail.ts.
const RUNTIME_SECRET_ENV_KEYS = [
  "MONGO_URI", "MONGO_URI_DIRECT", "AUTH_SECRET", "AUTH_URL",
  "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GEMINI_API_KEY", "GEMINI_API_KEY_LIVE",
  "INTERNAL_CRON_SECRET", "WEBHOOK_SECRET",
  "MAIL_PROVIDER", "MAIL_API_KEY", "MAIL_FROM",
  "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_CONNECT_CLIENT_ID",
  "RESEND_API_KEY", "EMAIL_FROM", "PII_ENCRYPTION_KEY",
  "FACEBOOK_APP_ID", "FACEBOOK_APP_SECRET",
  "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN",
  "COST_DATA_UNLOCK_SECRET", "PLATFORM_GLOBAL_EMBED_KEY", "PLATFORM_BOT_EMBED_KEY",
  "ADMIN_TOTP_SECRET", "PLATFORM_GLOBAL_CHAT_TENANT_ID", "ZUDO_GUIDE_EMBED_KEY",
  "GOOGLE_EXTENSION_OAUTH_CLIENT_ID", "CLIENT_ID", "COMPANY_TAX_ID",
  "MONGO_DNS_SERVERS", "WIDGET_SCRIPT_INTEGRITY", "DATABASE_URL", "DIRECT_URL",
];

const runtimeSecretEnv = Object.fromEntries(
  RUNTIME_SECRET_ENV_KEYS
    .filter((key) => process.env[key])
    .map((key) => [key, process.env[key]]),
);

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  env: runtimeSecretEnv,
  experimental: {
    instrumentationHook: true,
    // Next 14 — keep Node-only deps out of RSC/webpack client graph
    serverComponentsExternalPackages: ["pdf-parse", "mammoth", "mongoose"],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "zudobotstorage.s3.ap-southeast-2.amazonaws.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
