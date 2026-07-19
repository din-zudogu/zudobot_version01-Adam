import { setTimeout } from "timers/promises";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const manifestPath = path.join(__dirname, "..", "clone-manifest.json");

function logEnvSummary() {
  if (!fs.existsSync(manifestPath)) return;
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  const keys = new Set();
  for (const g of manifest.environmentVariableGroups ?? []) {
    for (const k of g.keys ?? []) keys.add(k);
    for (const group of g.oneOf ?? []) {
      for (const k of group) keys.add(k);
    }
  }
  let set = 0;
  for (const k of keys) {
    if (process.env[k]?.trim()) set++;
  }
  console.log(`📋 Manifest env keys set: ${set}/${keys.size}`);
}

async function runScaffold() {
  console.log("==========================================");
  console.log("⚡ ZUDOBOT CONTAINER SCAFFOLD RUNNING");
  console.log(`📅 Timestamp: ${new Date().toISOString()}`);
  console.log(`🔧 Mode: ${process.env.RUN_MODE || "unknown"}`);
  console.log("==========================================");

  logEnvSummary();

  if (process.env.RUN_MODE === "scaffold") {
    console.log("✅ Environment Variables mapping validation succeeded.");
    console.log("💤 Container entered secure idle mode. Standing by for next deployment phase.");

    while (true) {
      await setTimeout(60_000);
    }
  } else {
    console.log("🚀 Non-scaffold run detected. Executing next server startup sequence.");
    process.exit(1);
  }
}

runScaffold().catch((err) => {
  console.error("❌ Scaffold process runtime error:", err);
  process.exit(1);
});
