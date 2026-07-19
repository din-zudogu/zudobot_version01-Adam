/**
 * POST seed-global-chat-tenant on production (uses Amplify MONGO_URI server-side).
 * Usage: node scripts/trigger-seed-global-chat-tenant.mjs
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
const baseUrl =
  getEnv("NEXT_PUBLIC_APP_URL")?.replace(/\/$/, "") || "https://zudobot.zudogu.com";

if (!secret) {
  console.error("❌  INTERNAL_CRON_SECRET missing in apps/web/.env.local");
  process.exit(1);
}

const url = `${baseUrl}/api/cron/seed-global-chat-tenant`;
console.log("POST", url);

const res = await fetch(url, {
  method: "POST",
  headers: { Authorization: `Bearer ${secret}` },
});

const body = await res.json().catch(() => ({}));
console.log("Status:", res.status);
console.log(JSON.stringify(body, null, 2));

if (!res.ok) process.exit(1);
