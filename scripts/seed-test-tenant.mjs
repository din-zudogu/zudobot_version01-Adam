/**
 * Zudobot — Seed Test Tenant
 *
 * Creates a test tenant with publicKey + secretKey for local development.
 * Usage: node scripts/seed-test-tenant.mjs
 */

import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import crypto from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env.local from apps/api
const envPath = path.join(__dirname, "..", "apps", "api", ".env.local");
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const [k, ...v] = line.split("=");
    if (k && v.length) process.env[k.trim()] = v.join("=").trim();
  }
}

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error("❌  MONGO_URI not found in apps/api/.env.local");
  process.exit(1);
}

import mongoose from "mongoose";

await mongoose.connect(MONGO_URI);
console.log("✅  MongoDB connected");

const tenantSchema = new mongoose.Schema({
  name: String,
  publicKey: { type: String, unique: true },
  secretKey: { type: String, unique: true },
  allowedDomains: [String],
  plan: String,
  messageBalance: Number,
  expiryDate: Date,
  isActive: Boolean,
}, { timestamps: true });

const BotConfigSchema = new mongoose.Schema({
  tenantId: mongoose.Schema.Types.ObjectId,
  botName: String,
  botIntro: String,
  toneOfVoice: String,
  primaryLanguage: String,
  customKnowledge: String,
  maxDiscountPercent: Number,
  forbiddenTopics: [String],
  themeColor: String,
  position: String,
});

const Tenant = mongoose.models.Tenant || mongoose.model("Tenant", tenantSchema);
const BotConfig = mongoose.models.BotConfig || mongoose.model("BotConfig", BotConfigSchema);

// Check if test tenant already exists
let tenant = await Tenant.findOne({ name: "Test Store (Zudobot Dev)" });

if (!tenant) {
  const publicKey  = "pk_test_" + crypto.randomBytes(16).toString("hex");
  const secretKey  = "sk_test_" + crypto.randomBytes(24).toString("hex");
  const expiry = new Date(); expiry.setFullYear(expiry.getFullYear() + 1);

  tenant = await Tenant.create({
    name: "Test Store (Zudobot Dev)",
    publicKey,
    secretKey,
    allowedDomains: [],        // empty = allow all origins (dev mode)
    plan: "trial",
    messageBalance: 1000,
    expiryDate: expiry,
    isActive: true,
  });

  await BotConfig.create({
    tenantId: tenant._id,
    botName: "น้องซูโด้",
    botIntro: "สวัสดีค่ะ! น้องซูโด้ยินดีให้บริการค่ะ 😊 มีอะไรให้ช่วยไหมคะ?",
    toneOfVoice: "FRIENDLY",
    primaryLanguage: "th",
    customKnowledge: "",
    maxDiscountPercent: 10,
    forbiddenTopics: [],
    themeColor: "#6366f1",
    position: "bottom-right",
  });

  console.log("\n🎉  Test tenant created!\n");
  console.log(`   Public Key  : ${publicKey}`);
  console.log(`   Secret Key  : ${secretKey}`);
  console.log(`   Tenant ID   : ${tenant._id}`);
  console.log(`   Balance     : 1000 messages`);
} else {
  console.log("\n✅  Test tenant already exists\n");
  console.log(`   Public Key  : ${tenant.publicKey}`);
  console.log(`   Secret Key  : ${tenant.secretKey}`);
  console.log(`   Tenant ID   : ${tenant._id}`);
}

console.log("\n📋  Next steps:");
console.log("   1. Copy Public Key → paste in packages/widget/test/index.html");
console.log("   2. cd apps/api && npm run dev  (port 4000)");
console.log("   3. Open packages/widget/test/index.html in browser");
console.log("\n   หรือ test ด้วย curl:");
console.log(`   curl http://localhost:4000/api/v1/bot/config -H "x-api-key: ${tenant.publicKey}"`);

await mongoose.disconnect();
