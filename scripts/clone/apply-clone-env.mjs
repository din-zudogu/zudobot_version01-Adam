#!/usr/bin/env node
/**
 * Pre-flight validation for docker/env/local.env (Amplify guardrail keys).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..", "..");

const REQUIRED_ENVS = [
  "AUTH_SECRET",
  "AUTH_URL",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
];

function validateEnv() {
  console.log("🔍 Validating Sandbox Environment Variables Configuration...");

  const envPath = path.resolve(ROOT, "docker/env/local.env");
  if (!fs.existsSync(envPath)) {
    console.error(`❌ Error: Local configuration mapping file not found at: ${envPath}`);
    console.error("   Copy docker/env/docker.local.env.example → docker/env/local.env");
    process.exit(1);
  }

  const content = fs.readFileSync(envPath, "utf-8");
  const lines = content.split("\n");
  const envMap = {};

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const [key, ...valueParts] = trimmed.split("=");
      if (key) envMap[key.trim()] = valueParts.join("=").trim();
    }
  });

  let hasError = false;

  REQUIRED_ENVS.forEach((envKey) => {
    if (!envMap[envKey]) {
      console.error(`✗ missing required: ${envKey}`);
      hasError = true;
    } else {
      console.log(`✓ ${envKey}`);
    }
  });

  if (!envMap.GEMINI_API_KEY && !envMap.GEMINI_API_KEY_LIVE) {
    console.error("✗ need one of: GEMINI_API_KEY | GEMINI_API_KEY_LIVE");
    hasError = true;
  } else {
    console.log("✓ GEMINI_API_KEY or GEMINI_API_KEY_LIVE");
  }

  if (!envMap.MONGO_URI && !envMap.MONGODB_PRODUCTION_URI) {
    console.warn("⚠ MONGO_URI or MONGODB_PRODUCTION_URI not set (required for DB clone / runtime)");
  } else if (envMap.MONGO_URI) {
    console.log("✓ MONGO_URI");
  }

  if (hasError) {
    console.error(
      "\n🛑 Configuration error detected. Please populate missing properties inside docker/env/local.env",
    );
    process.exit(1);
  }

  console.log("✅ All configurations are valid and compliant for AWS Amplify Deployment Sandbox.");
}

validateEnv();
