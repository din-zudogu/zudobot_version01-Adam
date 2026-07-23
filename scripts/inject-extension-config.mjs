/**
 * inject-extension-config.mjs
 *
 * Runs during Amplify preBuild. Reads GOOGLE_EXTENSION_OAUTH_CLIENT_ID from environment
 * and injects it into the Chrome Extension manifest.json, then rebuilds
 * the extension zip ready for Web Store submission or developer testing.
 *
 * Usage:
 *   node scripts/inject-extension-config.mjs            # normal (updates + zips)
 *   node scripts/inject-extension-config.mjs --dry-run  # preview only, no write
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, dirname }                         from "path";
import { fileURLToPath }                            from "url";
import { execSync }                                 from "child_process";

const __dirname  = dirname(fileURLToPath(import.meta.url));
const ROOT       = resolve(__dirname, "..");
const MANIFEST   = resolve(ROOT, "integrations/path2-chrome-extension/manifest.json");
const EXT_DIR    = resolve(ROOT, "integrations/path2-chrome-extension");
const ZIP_OUT    = resolve(ROOT, "integrations/path2-chrome-extension.zip");
const DRY_RUN    = process.argv.includes("--dry-run");

// ── 1. Read env var ───────────────────────────────────────────────────────────

const clientId = process.env.GOOGLE_EXTENSION_OAUTH_CLIENT_ID?.trim();

if (!clientId) {
  console.warn("[extension-config] ⚠️  GOOGLE_EXTENSION_OAUTH_CLIENT_ID is not set — skipping injection.");
  console.warn("                      manifest.json will keep its current oauth2.client_id value.");
  process.exit(0);
}

// ── 2. Update manifest.json ───────────────────────────────────────────────────

if (!existsSync(MANIFEST)) {
  console.error(`[extension-config] ❌ manifest.json not found at: ${MANIFEST}`);
  process.exit(1);
}

const manifest   = JSON.parse(readFileSync(MANIFEST, "utf8"));
const prevId     = manifest.oauth2?.client_id ?? "(none)";

if (prevId === clientId) {
  console.log("[extension-config] ✅ client_id already up-to-date — no change needed.");
} else {
  if (!manifest.oauth2) manifest.oauth2 = { scopes: ["openid", "email", "profile"] };
  manifest.oauth2.client_id = clientId;

  if (!DRY_RUN) {
    writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n", "utf8");
    console.log(`[extension-config] ✅ manifest.json updated`);
    console.log(`                      ${prevId} → ${clientId.slice(0, 12)}...`);
  } else {
    console.log(`[extension-config] 🔍 DRY RUN — would update client_id:`);
    console.log(`                      ${prevId} → ${clientId.slice(0, 12)}...`);
  }
}

// ── 3. Rebuild zip ────────────────────────────────────────────────────────────

if (DRY_RUN) {
  console.log("[extension-config] 🔍 DRY RUN — skipping zip rebuild.");
  process.exit(0);
}

console.log("[extension-config] 📦 Rebuilding extension zip...");

try {
  // Remove existing zip
  try { execSync(`rm -f "${ZIP_OUT}"`, { stdio: "pipe" }); } catch { /* ok on Windows */ }

  // Zip — exclude keys directory and pem files (secrets must not be in zip)
  execSync(
    `cd "${EXT_DIR}" && zip -r "${ZIP_OUT}" . -x "keys/*" -x "*.pem" -x ".gitignore" -x "README.md"`,
    { stdio: "inherit" },
  );
  console.log(`[extension-config] ✅ zip rebuilt → ${ZIP_OUT}`);
} catch {
  // zip command not available (Windows without tools) — warn and continue
  console.warn("[extension-config] ⚠️  zip command not available — skipping zip rebuild.");
  console.warn("                      Run manually: cd integrations && zip -r path2-chrome-extension.zip path2-chrome-extension -x 'keys/*'");
}

console.log("[extension-config] 🎉 Done.");
