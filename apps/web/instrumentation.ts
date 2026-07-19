/**
 * Next.js server startup — enforce Amplify-only env for secrets (see Coding_Rules.txt).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;

  const { validateAmplifyEnvironment } = await import("@/lib/env/amplifyGuardrail");
  validateAmplifyEnvironment();

  // Pricing deploy bootstrap runs via admin API / cron — not here.
  // Importing MongoDB modules in instrumentation pulls node:dns into the client webpack graph and breaks `next build`.
}
