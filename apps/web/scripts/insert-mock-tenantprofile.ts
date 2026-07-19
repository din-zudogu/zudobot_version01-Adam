/**
 * Insert mock User + TenantProfile for PLATFORM_GLOBAL_CHAT_TENANT_ID
 * Usage: cd apps/web && npx tsx scripts/insert-mock-tenantprofile.ts
 */

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import dns from "node:dns";
import mongoose from "mongoose";
import { encodeMongoUri, parseMongoCredentials } from "../lib/db/mongoUri";
import { TenantProfileModel } from "../lib/db/models/TenantProfile";
import { UserModel } from "../lib/db/models/User";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

if (process.platform === "win32") {
  dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
}

async function connectForScript(): Promise<void> {
  const srv = process.env.MONGO_URI?.trim();
  const direct = process.env.MONGO_URI_DIRECT?.trim();
  const opts = { dbName: "zudobot_saas", serverSelectionTimeoutMS: 15_000 };

  if (srv) {
    try {
      await mongoose.connect(encodeMongoUri(srv), { ...opts, bufferCommands: false });
      return;
    } catch (err) {
      console.warn("MONGO_URI failed:", err instanceof Error ? err.message : err);
    }
  }

  if (direct) {
    const { uriWithoutCreds, username, password } = parseMongoCredentials(direct);
    await mongoose.connect(uriWithoutCreds, {
      ...opts,
      bufferCommands: false,
      user: username,
      pass: password,
      authSource: "admin",
    });
    return;
  }

  throw new Error("MONGO_URI / MONGO_URI_DIRECT missing in apps/web/.env.local");
}

const TENANT_ID = "6a131c821296d01b12412734";
const MOCK_EMAIL = "mock-universal-embed@zudobot.internal";

async function main() {
  await connectForScript();
  console.log("✅  MongoDB connected (zudobot_saas)");

  const existing = await TenantProfileModel.findOne({ tenantId: TENANT_ID }).lean();
  if (existing) {
    console.log("⚠️  tenantprofiles already exists");
    console.log("   tenantId:", existing.tenantId);
    console.log("   embedKey:", existing.embedKey);
    console.log("\n👉  PLATFORM_GLOBAL_CHAT_TENANT_ID=" + TENANT_ID);
    await mongoose.disconnect();
    return;
  }

  const oid = new mongoose.Types.ObjectId(TENANT_ID);
  const existingUser = await UserModel.findById(oid);
  if (!existingUser) {
    await UserModel.create({
      _id: oid,
      email: MOCK_EMAIL,
      name: "Mock Universal Embed Tenant",
      role: "tenant",
      roles: ["tenant"],
      tenantId: TENANT_ID,
      botState: "active",
      onboardingComplete: true,
    });
    console.log("✅  Created users document");
  } else {
    console.log("ℹ️  users document already exists");
  }

  const embedKey = crypto.randomBytes(16).toString("hex");
  await TenantProfileModel.create({
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
    embedKey,
    lineEnabled: false,
    lineNotifyEnabled: false,
  });

  console.log("✅  Created tenantprofiles document");
  console.log("   tenantId:", TENANT_ID);
  console.log("   embedKey:", embedKey);
  console.log("\n👉  AWS Amplify:");
  console.log("   PLATFORM_GLOBAL_CHAT_TENANT_ID=" + TENANT_ID);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("❌  Failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
