/**
 * Zudobot — Seed "Zudo Guide" internal support bot
 * Usage: node scripts/seed-zudo-guide.mjs
 *
 * Creates a TenantProfile + User for the built-in dashboard support assistant.
 * Run once after initial setup. Safe to re-run (idempotent).
 */

import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import crypto from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env.local from apps/web (owns zudobot_saas DB)
const envPath = path.join(__dirname, "..", "apps", "web", ".env.local");
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const k = line.slice(0, eq).trim();
    const v = line.slice(eq + 1).trim();
    if (k) process.env[k] = v;
  }
} else {
  console.warn("⚠️  apps/web/.env.local not found — falling back to process env");
}

function fixMongoUri(uri) {
  const schemeMatch = uri.match(/^(mongodb(?:\+srv)?:\/\/)/);
  if (!schemeMatch) return uri;
  const scheme = schemeMatch[1];
  const rest = uri.slice(scheme.length);
  const lastAt = rest.lastIndexOf("@");
  if (lastAt === -1) return uri;
  const credentials = rest.slice(0, lastAt);
  const hostAndMore = rest.slice(lastAt + 1);
  const firstColon = credentials.indexOf(":");
  if (firstColon === -1) return uri;
  const user     = credentials.slice(0, firstColon);
  const password = credentials.slice(firstColon + 1);
  return `${scheme}${user}:${encodeURIComponent(password)}@${hostAndMore}`;
}

const rawUri = process.env.MONGODB_URI || process.env.MONGO_URI;
if (!rawUri) {
  console.error("❌  MONGODB_URI not found. Add it to apps/web/.env.local");
  process.exit(1);
}

import mongoose from "mongoose";

const MONGO_URI = fixMongoUri(rawUri);

console.log("🔌  Connecting to MongoDB...");
await mongoose.connect(MONGO_URI, { dbName: "zudobot_saas" });
console.log("✅  MongoDB connected\n");

// ── Inline schemas (avoid TS path alias issues in plain node) ──────────────────

const UserSchema = new mongoose.Schema({
  email:              { type: String, unique: true },
  name:               String,
  role:               { type: String, default: "tenant" },
  tenantId:           String,
  botState:           { type: String, default: "active" },
  onboardingComplete: { type: Boolean, default: false },
}, { timestamps: true });

const TenantProfileSchema = new mongoose.Schema({
  tenantId:           { type: String, required: true, unique: true },
  businessName:       { type: String, required: true },
  businessType:       { type: String, required: true },
  botName:            { type: String, default: "Zudo Guide" },
  botTone:            { type: String, default: "friendly" },
  welcomeMessage:     { type: String },
  widgetColor:        { type: String, default: "#1E5BC6" },
  widgetPosition:     { type: String, default: "bottom-right" },
  widgetEnabled:      { type: Boolean, default: true },
  allowedDomains:     { type: [String], default: [] },
  embedKey:           { type: String, required: true, unique: true },
  dailyMessageCount:  { type: Number, default: 0 },
  dailyMessageResetAt:{ type: Date,   default: () => new Date() },
  totalMessageCount:  { type: Number, default: 0 },
  quotaAlert80Sent:   { type: Boolean, default: false },
  quotaAlert95Sent:   { type: Boolean, default: false },
}, { timestamps: true });

const User          = mongoose.models.User          || mongoose.model("User",          UserSchema,          "users");
const TenantProfile = mongoose.models.TenantProfile || mongoose.model("TenantProfile", TenantProfileSchema, "tenantprofiles");

// ── Idempotency check ─────────────────────────────────────────────────────────

const existing = await TenantProfile.findOne({ businessName: "Zudo Guide (Internal)" });

if (existing) {
  console.log("✅  Zudo Guide already exists — no changes made.\n");
  console.log(`   Embed Key : ${existing.embedKey}`);
  console.log("\n👉  Add this to apps/web/.env.local:");
  console.log(`   ZUDO_GUIDE_EMBED_KEY=${existing.embedKey}\n`);
  await mongoose.disconnect();
  process.exit(0);
}

// ── Create User + TenantProfile ───────────────────────────────────────────────

const userId   = new mongoose.Types.ObjectId();
const embedKey = "internal_zg_" + crypto.randomBytes(24).toString("hex");

await User.create({
  _id:                userId,
  email:              "zudo-guide-internal@zudobot.internal",
  name:               "Zudo Guide",
  role:               "tenant",
  tenantId:           userId.toString(),
  botState:           "active",
  onboardingComplete: true,
});

await TenantProfile.create({
  tenantId:       userId.toString(),
  businessName:   "Zudo Guide (Internal)",
  businessType:   "saas_support",
  botName:        "Zudo Guide",
  botTone:        "friendly",
  welcomeMessage: "สวัสดีครับ! ผม Zudo Guide ยินดีช่วยคุณใช้งาน Zudobot ครับ 😊\nมีอะไรให้ช่วยไหมครับ?",
  widgetColor:    "#1E5BC6",
  widgetPosition: "bottom-right",
  widgetEnabled:  true,
  allowedDomains: ["zudobot.zudogu.com", "localhost"],
  embedKey,
});

console.log("🎉  Zudo Guide created!\n");
console.log(`   Tenant ID : ${userId}`);
console.log(`   Embed Key : ${embedKey}`);
console.log("\n👉  Add this to apps/web/.env.local:");
console.log(`   ZUDO_GUIDE_EMBED_KEY=${embedKey}\n`);
console.log("⚠️  Re-deploy after adding the env var.\n");

await mongoose.disconnect();
