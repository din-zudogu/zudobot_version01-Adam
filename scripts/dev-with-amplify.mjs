/**
 * Start Next.js dev server with environment variables from AWS Amplify (no local .env).
 *
 * Prerequisites (shell / system env — NOT apps/*/.env.local):
 *   ACCESS_KEY_ID      or AWS_ACCESS_KEY_ID
 *   SECRET_ACCESS_KEY  or AWS_SECRET_ACCESS_KEY
 *   AMPLIFY_APP_ID     (optional, default d9czp7mb1m4w2)
 *   AMPLIFY_BRANCH     (optional, default master)
 *   AWS_REGION         (optional, default ap-southeast-2)
 *
 * Usage: npm run dev:amplify
 */

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "url";
import {
  applyAwsCredentialAliases,
  loadAmplifyEnv,
} from "./lib/loadAmplifyEnv.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..");

applyAwsCredentialAliases();

if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
  console.error("❌ ต้องตั้งค่า credentials ก่อนรัน dev:amplify:");
  console.error("   1) สร้าง .env.aws.local จาก .env.aws.local.example (ACCESS_KEY_ID + SECRET_ACCESS_KEY)");
  console.error("   2) หรือ $env:ACCESS_KEY_ID / $env:SECRET_ACCESS_KEY ใน PowerShell");
  console.error("   3) หรือ aws configure");
  process.exit(1);
}

console.log("📡 กำลังโหลด Environment Variables จาก AWS Amplify…\n");

let meta;
try {
  meta = await loadAmplifyEnv({ all: true });
} catch (err) {
  console.error("❌ โหลดจาก Amplify ไม่สำเร็จ:", err.message);
  process.exit(1);
}

const count = Object.keys(meta.vars).length;
console.log(`✅ โหลด ${count} ตัวแปรจาก Amplify`);
console.log(`   app: ${meta.appId} | branch: ${meta.branch} | region: ${meta.region ?? "ap-southeast-2"}`);
console.log(`   MONGO_URI: ${meta.vars.MONGO_URI ? "set" : "missing"}`);
console.log(`   AUTH_SECRET: ${meta.vars.AUTH_SECRET || meta.vars.NEXTAUTH_SECRET ? "set" : "missing"}`);
console.log("\n🚀 เริ่ม Next.js dev (apps/web)…\n");
console.log("   หมายเหตุ: ค่าที่ตั้งจาก Amplify จะ override .env.local สำหรับ key ที่ซ้ำกัน\n");

process.env.NODE_ENV = "development";
// NextAuth v5 on Amplify uses AUTH_URL / AUTH_SECRET
if (!process.env.AUTH_URL && process.env.NEXTAUTH_URL) {
  process.env.AUTH_URL = process.env.NEXTAUTH_URL;
}
if (!process.env.NEXTAUTH_URL && process.env.AUTH_URL) {
  process.env.NEXTAUTH_URL = process.env.AUTH_URL;
}

const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const child = spawn(npmCmd, ["run", "dev", "--workspace=apps/web"], {
  cwd: repoRoot,
  stdio: "inherit",
  env: process.env,
  shell: process.platform === "win32",
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});

child.on("error", (err) => {
  console.error("❌ ไม่สามารถเริ่ม dev server:", err.message);
  process.exit(1);
});
