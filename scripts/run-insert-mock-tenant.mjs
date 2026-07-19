/**
 * Load MONGO_URI from AWS Amplify then insert mock tenantprofile.
 * Requires .env.aws.local with ACCESS_KEY_ID + SECRET_ACCESS_KEY
 * Usage: node scripts/run-insert-mock-tenant.mjs
 */

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "url";
import { applyAwsCredentialAliases, loadAmplifyEnv } from "./lib/loadAmplifyEnv.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..");

applyAwsCredentialAliases();

if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
  console.error("❌  ไม่มี AWS credentials — ใช้ node apps/web/scripts/insert-mock-tenantprofile.mjs แทน");
  console.error("   หรือสร้าง .env.aws.local จาก .env.aws.local.example");
  process.exit(1);
}

console.log("📡  โหลด MONGO_URI จาก AWS Amplify…");
const meta = await loadAmplifyEnv({ keys: ["MONGO_URI", "MONGO_URI_DIRECT"] });
if (!meta.vars.MONGO_URI && !meta.vars.MONGO_URI_DIRECT) {
  console.error("❌  ไม่พบ MONGO_URI บน Amplify");
  process.exit(1);
}
for (const [k, v] of Object.entries(meta.vars)) {
  if (v) process.env[k] = v;
}

const script = path.join(repoRoot, "apps", "web", "scripts", "insert-mock-tenantprofile.mjs");
const child = spawn(process.execPath, [script], {
  cwd: repoRoot,
  stdio: "inherit",
  env: { ...process.env },
});

child.on("exit", (code) => process.exit(code ?? 1));
