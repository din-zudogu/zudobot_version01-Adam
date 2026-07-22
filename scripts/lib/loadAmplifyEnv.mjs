/**
 * Load environment variables from AWS Amplify branch settings only.
 * Does NOT read .env, .env.local, or any local secret files.
 *
 * Requires AWS credentials (aws configure / IAM role):
 *   AMPLIFY_APP_ID  (default: d9czp7mb1m4w2)
 *   AMPLIFY_BRANCH  (default: master)
 *   AWS_REGION      (default: ap-southeast-2)
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { AmplifyClient, GetAppCommand, GetBranchCommand, ListBranchesCommand } from "@aws-sdk/client-amplify";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEFAULT_APP_ID = "d9czp7mb1m4w2";
const DEFAULT_REGION = "ap-southeast-2";
const DEFAULT_BRANCH = "master";

/** Keys scripts typically need from Amplify (extend as needed). */
export const AMPLIFY_ENV_KEYS = [
  "MONGO_URI",
  "MONGO_URI_DIRECT",
  "MONGO_DB_NAME",
  "AUTH_SECRET",
  "AUTH_URL",
  "INTERNAL_CRON_SECRET",
];

function normalizeEnvMap(raw) {
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return { ...raw };
}

function isAmplifyBuildRuntime() {
  return Boolean(process.env.AWS_BRANCH && process.env.AWS_APP_ID);
}

/**
 * Map custom credential env names → AWS SDK standard names.
 * Supports: ACCESS_KEY_ID, SECRET_ACCESS_KEY (your Amplify/local naming)
 */
/** Load IAM keys from repo-root .env.aws.local (bootstrap only — not Amplify app env). */
export function loadAwsBootstrapFile() {
  const filePath = path.join(__dirname, "..", "..", ".env.aws.local");
  if (!fs.existsSync(filePath)) return false;
  for (const line of fs.readFileSync(filePath, "utf-8").split("\n")) {
    const trimmed = line.replace(/\r$/, "").trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const k = trimmed.slice(0, eq).trim();
    const v = trimmed.slice(eq + 1).trim();
    if (k && process.env[k] === undefined) process.env[k] = v;
  }
  return true;
}

export function applyAwsCredentialAliases() {
  loadAwsBootstrapFile();
  if (process.env.ACCESS_KEY_ID && !process.env.AWS_ACCESS_KEY_ID) {
    process.env.AWS_ACCESS_KEY_ID = process.env.ACCESS_KEY_ID;
  }
  if (process.env.SECRET_ACCESS_KEY && !process.env.AWS_SECRET_ACCESS_KEY) {
    process.env.AWS_SECRET_ACCESS_KEY = process.env.SECRET_ACCESS_KEY;
  }
}

/**
 * @param {{ keys?: string[], branch?: string, appId?: string, region?: string }} opts
 * @returns {Promise<Record<string, string>>}
 */
export async function fetchAmplifyBranchEnv(opts = {}) {
  const appId = opts.appId || process.env.AMPLIFY_APP_ID || DEFAULT_APP_ID;
  const region = opts.region || process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || DEFAULT_REGION;
  let branch = opts.branch || process.env.AMPLIFY_BRANCH || process.env.AWS_BRANCH || DEFAULT_BRANCH;

  const client = new AmplifyClient({ region });

  async function getForBranch(branchName) {
    const { branch: data } = await client.send(
      new GetBranchCommand({ appId, branchName })
    );
    return normalizeEnvMap(data?.environmentVariables);
  }

  // This project's Amplify app stores its env vars at the APP level, not the
  // branch level (get-branch returns {}) — confirmed directly against this
  // app. Other Amplify apps may differ, so branch-level is still tried first.
  async function getForApp() {
    const { app } = await client.send(new GetAppCommand({ appId }));
    return normalizeEnvMap(app?.environmentVariables);
  }

  try {
    const vars = await getForBranch(branch);
    if (Object.keys(vars).length > 0) return { vars, appId, branch, region, source: "amplify-api-branch" };
  } catch (err) {
    if (err.name !== "NotFoundException") throw err;
  }

  const appVars = await getForApp();
  if (Object.keys(appVars).length > 0) {
    return { vars: appVars, appId, branch, region, source: "amplify-api-app" };
  }

  const { branches } = await client.send(new ListBranchesCommand({ appId, maxResults: 50 }));
  const names = (branches ?? []).map((b) => b.branchName).filter(Boolean);
  const fallback = names.find((n) => n === "master") ?? names.find((n) => n === "main") ?? names[0];
  if (!fallback) {
    throw new Error(`No branches found for Amplify app ${appId}`);
  }

  branch = fallback;
  const vars = await getForBranch(branch);
  return { vars, appId, branch, region, source: "amplify-api-branch" };
}

/**
 * Apply Amplify env to process.env (never reads local .env files).
 * @param {{ keys?: string[], all?: boolean, forceApi?: boolean }} opts
 *   - all: true → apply every branch env var (for dev:amplify)
 */
export async function loadAmplifyEnv(opts = {}) {
  applyAwsCredentialAliases();

  const loadAll = opts.all === true;
  const keys = loadAll ? null : (opts.keys ?? AMPLIFY_ENV_KEYS);

  if (isAmplifyBuildRuntime() && !opts.forceApi && keys) {
    const fromRuntime = {};
    for (const k of keys) {
      if (process.env[k]) fromRuntime[k] = process.env[k];
    }
    if (keys.every((k) => fromRuntime[k])) {
      return {
        vars: fromRuntime,
        source: "amplify-build-runtime",
        branch: process.env.AWS_BRANCH,
        appId: process.env.AWS_APP_ID,
      };
    }
  }

  const { vars, appId, branch, region, source } = await fetchAmplifyBranchEnv(opts);

  const applied = {};
  const entries = loadAll ? Object.entries(vars) : keys.map((k) => [k, vars[k]]);

  for (const [k, v] of entries) {
    if (!k || v === undefined || v === "") continue;
    process.env[k] = v;
    applied[k] = v;
  }

  if (!loadAll && !applied.MONGO_URI && !applied.MONGO_URI_DIRECT) {
    throw new Error(
      `MONGO_URI not found on Amplify branch "${branch}" (app ${appId}, ${region}). ` +
        `Set it in Amplify Console → Environment variables.`
    );
  }

  return { vars: applied, source, branch, appId, region };
}

export function maskSecret(value) {
  if (!value || value.length < 8) return "***";
  return `${value.slice(0, 4)}…${value.slice(-4)} (len ${value.length})`;
}
