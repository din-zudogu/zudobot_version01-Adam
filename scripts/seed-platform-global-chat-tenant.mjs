/**
 * Zudobot — Seed internal tenant for universal external embed chat backend
 * Usage: node scripts/seed-platform-global-chat-tenant.mjs
 *
 * Creates User + TenantProfile for PLATFORM_GLOBAL_CHAT_TENANT_ID only.
 * Does NOT modify merchant tenants. Safe to re-run (idempotent).
 */

import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import crypto from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MARKER_BUSINESS_NAME = "Zudobot Platform Global Embed (Internal)";

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
  const user = credentials.slice(0, firstColon);
  const password = credentials.slice(firstColon + 1);
  return `${scheme}${user}:${encodeURIComponent(password)}@${hostAndMore}`;
}

const rawUri = process.env.MONGODB_URI || process.env.MONGO_URI;
if (!rawUri) {
  console.error("❌  MONGO_URI not found. Add it to apps/web/.env.local");
  process.exit(1);
}

import mongoose from "mongoose";

const MONGO_URI = fixMongoUri(rawUri);

console.log("🔌  Connecting to MongoDB...");
await mongoose.connect(MONGO_URI, { dbName: "zudobot_saas" });
console.log("✅  MongoDB connected\n");

const UserSchema = new mongoose.Schema(
  {
    email: { type: String, unique: true },
    name: String,
    role: { type: String, default: "tenant" },
    roles: { type: [String], default: ["tenant"] },
    tenantId: String,
    botState: { type: String, default: "active" },
    onboardingComplete: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const TenantProfileSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true, unique: true },
    businessName: { type: String, required: true },
    businessType: { type: String, required: true },
    botName: { type: String, default: "Zudobot แอดมินหลัก" },
    botGender: { type: String, default: "female" },
    botTone: { type: String, default: "friendly" },
    welcomeMessage: { type: String },
    widgetColor: { type: String, default: "#3B82F6" },
    widgetPosition: { type: String, default: "bottom-right" },
    widgetEnabled: { type: Boolean, default: false },
    allowedDomain: { type: String, default: "" },
    allowedDomains: { type: [String], default: [] },
    embedKey: { type: String, required: true, unique: true },
    dailyMessageCount: { type: Number, default: 0 },
    dailyMessageResetAt: { type: Date, default: () => new Date() },
    totalMessageCount: { type: Number, default: 0 },
    quotaAlert80Sent: { type: Boolean, default: false },
    quotaAlert95Sent: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const User =
  mongoose.models.User || mongoose.model("User", UserSchema, "users");
const TenantProfile =
  mongoose.models.TenantProfile ||
  mongoose.model("TenantProfile", TenantProfileSchema, "tenantprofiles");

const existing = await TenantProfile.findOne({ businessName: MARKER_BUSINESS_NAME });

if (existing) {
  console.log("✅  Platform global chat tenant already exists.\n");
  console.log(`   tenantId  : ${existing.tenantId}`);
  console.log(`   embedKey  : ${existing.embedKey}`);
  console.log("\n👉  AWS Amplify Environment Variable:");
  console.log(`   PLATFORM_GLOBAL_CHAT_TENANT_ID=${existing.tenantId}\n`);
  console.log(
    "   (แยกจาก tenant เดิม 6a12901dece46bc2b25f72df — ใช้ tenant นี้เฉพาะ /api/public/zudobot/chat)\n"
  );
  await mongoose.disconnect();
  process.exit(0);
}

const userId = new mongoose.Types.ObjectId();
const embedKey = "global_chat_" + crypto.randomBytes(20).toString("hex");

await User.create({
  _id: userId,
  email: "platform-global-embed@zudobot.internal",
  name: "Zudobot Platform Global Embed",
  role: "tenant",
  roles: ["tenant"],
  tenantId: userId.toString(),
  botState: "active",
  onboardingComplete: true,
});

await TenantProfile.create({
  tenantId: userId.toString(),
  businessName: MARKER_BUSINESS_NAME,
  businessType: "platform_internal",
  botName: "Zudobot แอดมินหลัก",
  botGender: "female",
  botTone: "friendly",
  welcomeMessage: "สวัสดีครับ มีอะไรให้ผมช่วยเหลือไหมครับ",
  widgetColor: "#3B82F6",
  widgetPosition: "bottom-right",
  widgetEnabled: false,
  allowedDomain: "",
  allowedDomains: [],
  embedKey,
});

console.log("🎉  Platform global chat tenant created!\n");
console.log(`   tenantId  : ${userId.toString()}`);
console.log(`   embedKey  : ${embedKey}  (internal only — ไม่ใช้ฝังเว็บภายนอก)`);
console.log("\n👉  AWS Amplify Environment Variable:");
console.log(`   PLATFORM_GLOBAL_CHAT_TENANT_ID=${userId.toString()}\n`);
console.log(
  "   หมายเหตุ: tenantId 6a12901dece46bc2b25f72df เป็น tenant อื่น — อย่าใช้ซ้ำกับ global embed\n"
);

await mongoose.disconnect();
