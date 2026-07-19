#!/usr/bin/env node
/**
 * security-gate.mjs — build-time guard against re-introducing known mistakes.
 *
 * Run in CI (amplify.yml preBuild) and locally (`npm run security:gate`).
 * Exits non-zero (fails the build) if it finds:
 *   1. A public debug route directory (apps/web/app/api/debug) — these have
 *      leaked env/API-key info before. Debug endpoints must never ship.
 *   2. A hardcoded live secret committed to source (Google OAuth, Stripe live,
 *      AWS access key, or a Mongo URI with an inline password).
 *
 * Intentionally narrow to avoid false positives — it blocks the EXACT classes
 * of mistake we have already hit, not general style issues.
 */
import { readdirSync, statSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const failures = [];

// ── Rule 1: no debug route directory ────────────────────────────────
const debugDir = join(ROOT, "apps", "web", "app", "api", "debug");
if (existsSync(debugDir)) {
  failures.push(
    `Debug route directory exists: apps/web/app/api/debug — debug endpoints leak internals and must not ship. Delete it.`,
  );
}

// ── Rule 2: no hardcoded live secrets in source ─────────────────────
const SECRET_PATTERNS = [
  { name: "Google OAuth client secret", re: /GOCSPX-[A-Za-z0-9_-]{20,}/ },
  { name: "Stripe live secret key",     re: /sk_live_[A-Za-z0-9]{20,}/ },
  { name: "Stripe live restricted key", re: /rk_live_[A-Za-z0-9]{20,}/ },
  { name: "AWS access key id",          re: /AKIA[0-9A-Z]{16}/ },
  { name: "Mongo URI with password",    re: /mongodb(\+srv)?:\/\/[^:\s/]+:[^@\s/]+@/ },
];

const SCAN_DIRS = [
  join(ROOT, "apps", "web", "app"),
  join(ROOT, "apps", "web", "lib"),
  join(ROOT, "apps", "web", "components"),
  join(ROOT, "apps", "web", "middleware.ts"),
];
const SKIP = new Set(["node_modules", ".next", ".git", "dist", "build", ".turbo"]);
const TEXT_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|json|env|md|html)$/;

function walk(path) {
  let st;
  try { st = statSync(path); } catch { return; }
  if (st.isDirectory()) {
    if (SKIP.has(path.split(/[\\/]/).pop())) return;
    for (const entry of readdirSync(path)) walk(join(path, entry));
    return;
  }
  if (!TEXT_EXT.test(path)) return;
  let content;
  try { content = readFileSync(path, "utf8"); } catch { return; }
  for (const { name, re } of SECRET_PATTERNS) {
    if (re.test(content)) {
      failures.push(`Hardcoded ${name} found in ${path.replace(ROOT, ".")}`);
    }
  }
}

for (const dir of SCAN_DIRS) walk(dir);

// ── Report ──────────────────────────────────────────────────────────
if (failures.length > 0) {
  console.error("\n❌ Security gate FAILED:\n");
  for (const f of failures) console.error("   • " + f);
  console.error("\nFix the above before deploying.\n");
  process.exit(1);
}
console.log("✅ Security gate passed — no debug routes, no hardcoded secrets.");
