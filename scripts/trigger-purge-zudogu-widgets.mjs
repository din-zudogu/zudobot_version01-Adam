/**
 * Purge internal Zudobot widget tenants on production (site + zudo guide + platform global).
 * Usage:
 *   node scripts/trigger-purge-zudogu-widgets.mjs          # dry-run
 *   node scripts/trigger-purge-zudogu-widgets.mjs --live   # delete
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, "..", "apps", "web", ".env.local");
const envText = readFileSync(envPath, "utf8");

function getEnv(name) {
  for (const line of envText.split("\n")) {
    const t = line.replace(/\r$/, "").trim();
    if (t.startsWith(name + "=")) return t.slice(name.length + 1).trim();
  }
  return null;
}

const secret = getEnv("INTERNAL_CRON_SECRET");
const baseUrl = (getEnv("NEXT_PUBLIC_APP_URL") || "https://zudobot.zudogu.com").replace(
  /\/$/,
  ""
);
const live = process.argv.includes("--live");

if (!secret) {
  console.error("❌ INTERNAL_CRON_SECRET missing in apps/web/.env.local");
  process.exit(1);
}

const url = `${baseUrl}/api/cron/purge-zudogu-widgets${live ? "" : "?dryRun=1"}`;
console.log(live ? "⚠️  LIVE PURGE" : "🔬 DRY-RUN", "→", url);

const res = await fetch(url, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${secret}`,
    "x-cron-secret": secret,
  },
});

const body = await res.json().catch(() => ({}));
console.log("Status:", res.status);
console.log(JSON.stringify(body, null, 2));
if (!res.ok) process.exit(1);
