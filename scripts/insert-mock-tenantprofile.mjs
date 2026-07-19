/**
 * Insert mock User + TenantProfile into zudobot_saas (CLTZUDOBOT)
 * Usage: node scripts/insert-mock-tenantprofile.mjs
 */

import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import crypto from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const envPath = path.join(__dirname, "..", "apps", "web", ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const k = line.slice(0, eq).trim();
    const v = line.slice(eq + 1).trim();
    if (k) process.env[k] = v;
  }
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

const rawUri =
  process.env.MONGO_URI_DIRECT ||
  process.env.MONGODB_URI ||
  process.env.MONGO_URI;
if (!rawUri) {
  console.error("❌  MONGO_URI / MONGO_URI_DIRECT not found in apps/web/.env.local");
  process.exit(1);
}

import mongoose from "mongoose";

const TENANT_ID = "6a131c821296d01b12412734";
const MOCK_EMAIL = "mock-universal-embed@zudobot.internal";
const EMBED_KEY = crypto.randomBytes(16).toString("hex");

const now = new Date();
const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

const mockTenantProfile = {
  tenantId: TENANT_ID,
  businessName: "ร้านทดสอบ Universal Embed (Mock)",
  businessType: "ecommerce",
  websiteUrl: "https://mock-wordpress-demo.example.com",
  botName: "น้องซูโด (Mock)",
  botGender: "female",
  botTone: "friendly",
  welcomeMessage:
    "สวัสดีค่ะ ร้านทดสอบ Universal Embed ยินดีให้บริการค่ะ มีอะไรให้ช่วยไหมคะ?",
  widgetColor: "#3B82F6",
  widgetPosition: "bottom-right",
  widgetEnabled: false,
  allowedDomain: "",
  allowedDomains: [],
  quotaAlert80Sent: false,
  quotaAlert95Sent: false,
  monthlyMessageCount: 0,
  monthlyMessageResetAt: monthStart,
  embedKey: EMBED_KEY,
  trialStartedAt: now,
  lineEnabled: false,
  lineNotifyEnabled: false,
  dailyMessageCount: 0,
  dailyMessageResetAt: now,
  totalMessageCount: 0,
  createdAt: now,
  updatedAt: now,
};

const mockUser = {
  _id: new mongoose.Types.ObjectId(TENANT_ID),
  email: MOCK_EMAIL,
  name: "Mock Universal Embed Tenant",
  role: "tenant",
  roles: ["tenant"],
  tenantId: TENANT_ID,
  botState: "active",
  onboardingComplete: true,
  twoFactorEnabled: false,
  twoFactorVerified: false,
  createdAt: now,
  updatedAt: now,
};

const MONGO_URI = fixMongoUri(rawUri);

console.log("🔌  Connecting to CLTZUDOBOT / zudobot_saas ...");
await mongoose.connect(MONGO_URI, { dbName: "zudobot_saas" });

const db = mongoose.connection.db;
const users = db.collection("users");
const tenantprofiles = db.collection("tenantprofiles");

const existingProfile = await tenantprofiles.findOne({ tenantId: TENANT_ID });
if (existingProfile) {
  console.log("⚠️  tenantprofiles document already exists for tenantId:", TENANT_ID);
  console.log(JSON.stringify(existingProfile, null, 2));
  await mongoose.disconnect();
  process.exit(0);
}

const existingUser = await users.findOne({ _id: new mongoose.Types.ObjectId(TENANT_ID) });
if (!existingUser) {
  await users.insertOne(mockUser);
  console.log("✅  Inserted users document");
} else {
  console.log("ℹ️  users document already exists — skipped");
}

const insertResult = await tenantprofiles.insertOne(mockTenantProfile);
console.log("✅  Inserted tenantprofiles document");
console.log("   insertedId:", insertResult.insertedId.toString());
console.log("\n📋  tenantId (PLATFORM_GLOBAL_CHAT_TENANT_ID):", TENANT_ID);
console.log("   embedKey (internal):", EMBED_KEY);
console.log("\n👉  AWS Amplify:");
console.log(`   PLATFORM_GLOBAL_CHAT_TENANT_ID=${TENANT_ID}\n`);

await mongoose.disconnect();
console.log("Done.");
