/**
 * Print Amplify branch env keys (masked). No local .env files.
 * Usage: node scripts/print-amplify-env.mjs
 */

import {
  applyAwsCredentialAliases,
  loadAmplifyEnv,
  AMPLIFY_ENV_KEYS,
  maskSecret,
} from "./lib/loadAmplifyEnv.mjs";

applyAwsCredentialAliases();

try {
  const meta = await loadAmplifyEnv({ keys: AMPLIFY_ENV_KEYS });
  console.log("==== AWS Amplify environment ====");
  console.log(`source : ${meta.source}`);
  console.log(`appId  : ${meta.appId ?? process.env.AMPLIFY_APP_ID}`);
  console.log(`branch : ${meta.branch}`);
  if (meta.region) console.log(`region : ${meta.region}`);
  console.log("");
  for (const k of AMPLIFY_ENV_KEYS) {
    const v = meta.vars[k] ?? process.env[k];
    console.log(`  ${k}: ${v ? maskSecret(v) : "(not set)"}`);
  }
} catch (err) {
  console.error("❌", err.message);
  console.error("\nต้องมี AWS credentials ที่เข้าถึง Amplify app d9czp7mb1m4w2:");
  console.error("  ตั้ง ACCESS_KEY_ID + SECRET_ACCESS_KEY (หรือ AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY)");
  console.error("  npm run db:amplify-env");
  process.exit(1);
}
