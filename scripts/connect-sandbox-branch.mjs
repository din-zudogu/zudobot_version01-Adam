/**
 * Connect the `zdbsandbox` git branch to AWS Amplify as a dev environment.
 *
 * Usage:
 *   node scripts/connect-sandbox-branch.mjs
 *
 * Requires .env.aws.local at repo root with:
 *   ACCESS_KEY_ID=...
 *   SECRET_ACCESS_KEY=...
 *
 * What it does:
 *   1. Fetches all env vars from the `master` branch of the Amplify app
 *   2. Applies sandbox URL overrides
 *   3. Creates (or updates) the `zdbsandbox` branch in Amplify
 */

import {
  AmplifyClient,
  CreateBranchCommand,
  UpdateBranchCommand,
  GetBranchCommand,
  StartJobCommand,
} from "@aws-sdk/client-amplify";
import { applyAwsCredentialAliases, loadAwsBootstrapFile } from "./lib/loadAmplifyEnv.mjs";

loadAwsBootstrapFile();
applyAwsCredentialAliases();

const APP_ID = "d2upr1fu32ov02";
const REGION = "ap-southeast-2";
const SOURCE_BRANCH = "master";
const SANDBOX_BRANCH = "zdbsandbox";

// Derived sandbox base URL (Amplify auto-generates this for the branch)
const SANDBOX_BASE_URL = "https://zdbsandbox.zudogu.com";

const client = new AmplifyClient({ region: REGION });

// ── 1. Fetch all env vars from master ─────────────────────────────────────────

console.log(`[1/3] Fetching env vars from branch "${SOURCE_BRANCH}" (app ${APP_ID})...`);

let masterVars = {};
try {
  const { branch } = await client.send(
    new GetBranchCommand({ appId: APP_ID, branchName: SOURCE_BRANCH })
  );
  masterVars = branch?.environmentVariables ?? {};
  console.log(`      ✓ Found ${Object.keys(masterVars).length} env vars`);
} catch (err) {
  if (err.name === "NotFoundException") {
    console.error(`❌ Branch "${SOURCE_BRANCH}" not found in Amplify app ${APP_ID}`);
    console.error("   Make sure APP_ID is correct and credentials have Amplify read access.");
    process.exit(1);
  }
  throw err;
}

// ── 2. Build sandbox env vars (copy from master + URL overrides) ───────────────

const sandboxVars = {
  ...masterVars,
  // Override URL-related vars for sandbox environment
  AUTH_URL: SANDBOX_BASE_URL,
  NEXT_PUBLIC_APP_URL: SANDBOX_BASE_URL,
  NEXT_PUBLIC_URL: SANDBOX_BASE_URL,
  // API runs as a separate appRoot — same branch URL but different path in Amplify
  // If you have a separate API app, update NEXT_PUBLIC_API_URL manually in Amplify Console
};

// ── 3. Create or update the sandbox branch ────────────────────────────────────

console.log(`[2/3] Checking if branch "${SANDBOX_BRANCH}" exists in Amplify...`);

let branchExists = false;
try {
  await client.send(new GetBranchCommand({ appId: APP_ID, branchName: SANDBOX_BRANCH }));
  branchExists = true;
  console.log(`      Branch already connected — will update env vars.`);
} catch (err) {
  if (err.name !== "NotFoundException") throw err;
  console.log(`      Branch not connected yet — will create.`);
}

console.log(`[3/3] ${branchExists ? "Updating" : "Creating"} branch "${SANDBOX_BRANCH}"...`);

if (branchExists) {
  await client.send(
    new UpdateBranchCommand({
      appId: APP_ID,
      branchName: SANDBOX_BRANCH,
      environmentVariables: sandboxVars,
      enableAutoBuild: true,
    })
  );
} else {
  await client.send(
    new CreateBranchCommand({
      appId: APP_ID,
      branchName: SANDBOX_BRANCH,
      environmentVariables: sandboxVars,
      enableAutoBuild: true,
      framework: "Next.js - SSR",
      stage: "DEVELOPMENT",
      description: "Development/testing environment",
    })
  );
}

console.log(`\n✅ Done!`);
console.log(`\n   Branch  : ${SANDBOX_BRANCH}`);
console.log(`   App ID  : ${APP_ID}`);
console.log(`   Region  : ${REGION}`);
console.log(`   URL     : ${SANDBOX_BASE_URL}`);
console.log(`\n⚠️  ตรวจสอบใน Amplify Console:`);
console.log(`   1. MONGO_URI — ถ้าต้องการใช้ DB แยกสำหรับ sandbox ให้แก้ด้วยตนเอง`);
console.log(`   2. NEXT_PUBLIC_API_URL — ถ้า API app มี URL ต่างออกไปให้อัปเดต`);
console.log(`   3. STRIPE_* keys — ตรวจสอบว่าใช้ test keys (sk_test_...) แล้ว`);
console.log(`\n   Amplify Console: https://ap-southeast-2.console.aws.amazon.com/amplify/apps/${APP_ID}/branches`);

// Trigger an initial build
try {
  const { jobSummary } = await client.send(
    new StartJobCommand({
      appId: APP_ID,
      branchName: SANDBOX_BRANCH,
      jobType: "RELEASE",
    })
  );
  console.log(`\n🚀 Triggered initial build — job ID: ${jobSummary?.jobId}`);
} catch (err) {
  console.log(`\nℹ️  Could not trigger build automatically: ${err.message}`);
  console.log(`   ไป trigger ด้วยตนเองที่ Amplify Console`);
}
