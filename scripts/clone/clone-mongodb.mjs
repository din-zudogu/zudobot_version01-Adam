#!/usr/bin/env node
/**
 * MongoDB clone: production Atlas → local Docker sandbox.
 * Default: dry-run. Use --execute to run mongodump / mongorestore.
 */
import { execSync } from "child_process";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..", "..");
const isExecuteMode = process.argv.includes("--execute");

function loadLocalEnv() {
  const envPath = path.join(ROOT, "docker/env/local.env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    const v = t.slice(eq + 1).trim();
    if (k && process.env[k] === undefined) process.env[k] = v;
  }
}

async function syncDatabaseDump() {
  console.log("🗄️ Starting Zudobot Enterprise MongoDB Replication Wizard...");
  const dumpPath = path.resolve(ROOT, "docker/mongodb/dump");

  if (!isExecuteMode) {
    console.log("----------------------------------------------------------------------");
    console.log("ℹ️ CURRENT RUNNING MODE: [DRY-RUN]");
    console.log("To execute database cloning pipeline, append the flag: --execute");
    console.log("----------------------------------------------------------------------");
    console.log(`  dump path: ${dumpPath}`);
    console.log("  prod:  MONGODB_PRODUCTION_URI (from docker/env/local.env)");
    console.log("  local: mongodb://root:localsecretpassword@localhost:27017/zudobot?authSource=admin");
    return;
  }

  loadLocalEnv();

  const prodUri = process.env.MONGODB_PRODUCTION_URI;
  const localUri =
    process.env.MONGO_URI ??
    "mongodb://root:localsecretpassword@localhost:27017/zudobot?authSource=admin";

  if (!prodUri) {
    console.error("❌ Aborted: MONGODB_PRODUCTION_URI secret missing in current active parameters.");
    process.exit(1);
  }

  fs.mkdirSync(dumpPath, { recursive: true });

  try {
    console.log("📥 Dumping content from Production Atlas cluster securely...");
    execSync(`mongodump --uri="${prodUri}" --out="${dumpPath}" --gzip`, { stdio: "inherit" });

    console.log("📤 Restoring system schemas into Sandbox container cluster...");
    execSync(`mongorestore --drop --uri="${localUri}" --gzip "${dumpPath}"`, { stdio: "inherit" });

    console.log("✅ Database cloning and structural integrity mapping finished.");
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("❌ Database sync process terminal failure:", msg);
    process.exit(1);
  }
}

syncDatabaseDump();
