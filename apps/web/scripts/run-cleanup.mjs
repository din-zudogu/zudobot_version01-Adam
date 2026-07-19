// Plain ESM script — no dotenv needed, reads .env.local as raw text
// Handles special chars (^, @, $) in MongoDB password via URL encoding

import { readFileSync } from "fs";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, "..", ".env.local");

// Read .env.local as raw text to avoid shell interpolation issues
const envText = readFileSync(envPath, "utf8");
const lines = envText.split("\n");

function getEnvVar(name) {
  for (const line of lines) {
    // Strip \r from Windows CRLF line endings before trimming
    const trimmed = line.replace(/\r$/, "").trim();
    if (trimmed.startsWith(name + "=")) {
      return trimmed.slice(name.length + 1).replace(/\r$/, "");
    }
  }
  return null;
}

const rawUri = getEnvVar("MONGO_URI_DIRECT") ?? getEnvVar("MONGO_URI");
if (!rawUri) throw new Error("MONGO_URI not found in .env.local");

// Parse mongodb+srv://user:pass@host/... — handle @ in password by splitting from right
// Format: mongodb+srv://USERNAME:PASSWORD@HOST/PARAMS
const schemeMatch = rawUri.match(/^(mongodb(?:\+srv)?:\/\/)/);
if (!schemeMatch) throw new Error("Invalid MONGO_URI scheme");
const scheme = schemeMatch[1];
const rest = rawUri.slice(scheme.length);

// Find last @ to split credentials from host (password may contain @)
const lastAt = rest.lastIndexOf("@");
const credsPart = rest.slice(0, lastAt);
const hostPart = rest.slice(lastAt + 1);

// Split credentials on first colon
const firstColon = credsPart.indexOf(":");
const username = credsPart.slice(0, firstColon);
const password = credsPart.slice(firstColon + 1);

// URL-encode username and password
const encodedUser = encodeURIComponent(username);
const encodedPass = encodeURIComponent(password);

// Build a credentials-free URI — pass user/pass as explicit options to avoid any URI parsing of special chars
const uriWithoutCreds = `${scheme}${hostPart}`;
// Strip query params from hostPart to get just the host for logging
const hostOnly = hostPart.split("/")[0].split(",")[0];

console.log("[cleanup] Parsed URI — user:", username, "| first host:", hostOnly);
console.log("[cleanup] Connecting to MongoDB (credentials passed separately)...");

// Dynamic import mongoose (CommonJS compat)
const require = createRequire(import.meta.url);
const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    email:              { type: String, required: true, unique: true, lowercase: true },
    name:               { type: String },
    role:               { type: String },
    onboardingComplete: { type: Boolean, default: false },
    tenantId:           { type: String },
  },
  { timestamps: true }
);

const TenantProfileSchema = new mongoose.Schema(
  { tenantId: { type: String, required: true, unique: true } },
  { timestamps: true }
);

const UserModel =
  mongoose.models.User ?? mongoose.model("User", UserSchema);
const TenantProfileModel =
  mongoose.models.TenantProfile ?? mongoose.model("TenantProfile", TenantProfileSchema);

async function cleanup() {
  // Pass user/pass as explicit options — bypasses any URL encoding of special chars in the URI
  await mongoose.connect(uriWithoutCreds, {
    dbName: "zudobot_saas",
    user: username,
    pass: password,
    authSource: "admin",
  });
  console.log("[cleanup] Connected!");

  const staleUsers = await UserModel.find({
    onboardingComplete: false,
    role: { $in: ["tenant", "partner_admin"] },
  }).lean();

  if (staleUsers.length === 0) {
    console.log("[cleanup] No stale users found — DB is clean.");
    await mongoose.disconnect();
    return;
  }

  console.log(`\n[cleanup] Found ${staleUsers.length} stale user(s):`);
  staleUsers.forEach((u, i) => {
    console.log(`  ${i + 1}. ${u.email} (id: ${u._id}, name: ${u.name ?? "-"})`);
  });

  const userIds   = staleUsers.map((u) => u._id);
  const tenantIds = staleUsers.map((u) => u.tenantId ?? u._id.toString());

  const profileResult = await TenantProfileModel.deleteMany({
    tenantId: { $in: tenantIds },
  });
  console.log(`\n[cleanup] Deleted TenantProfiles: ${profileResult.deletedCount}`);

  const userResult = await UserModel.deleteMany({ _id: { $in: userIds } });
  console.log(`[cleanup] Deleted Users: ${userResult.deletedCount}`);

  console.log("\n[cleanup] Done.");
  await mongoose.disconnect();
}

cleanup().catch((err) => {
  console.error("[cleanup] Failed:", err);
  process.exit(1);
});
