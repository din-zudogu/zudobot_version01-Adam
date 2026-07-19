/**
 * Insert mock User + TenantProfile (PLATFORM_GLOBAL_CHAT_TENANT_ID backend)
 * Usage: node apps/web/scripts/insert-mock-tenantprofile.mjs
 */

import { readFileSync } from "fs";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import crypto from "crypto";
import dns from "node:dns";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, "..", ".env.local");

if (process.platform === "win32") {
  dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
}

const envText = readFileSync(envPath, "utf8");

function unquote(value) {
  const v = value.trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    return v.slice(1, -1);
  }
  return v;
}

function getEnvVar(name) {
  for (const line of envText.split("\n")) {
    const trimmed = line.replace(/\r$/, "").trim();
    if (trimmed.startsWith(name + "=")) {
      return unquote(trimmed.slice(name.length + 1).replace(/\r$/, ""));
    }
  }
  return null;
}

function encodeMongoUri(uri) {
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
  return `${scheme}${encodeURIComponent(user)}:${encodeURIComponent(password)}@${hostAndMore}`;
}

function parseUri(rawUri) {
  const schemeMatch = rawUri.match(/^(mongodb(?:\+srv)?:\/\/)/);
  if (!schemeMatch) throw new Error("Invalid MONGO_URI scheme");
  const scheme = schemeMatch[1];
  const rest = rawUri.slice(scheme.length);
  const lastAt = rest.lastIndexOf("@");
  if (lastAt === -1) throw new Error("MongoDB URI missing credentials");
  const credsPart = rest.slice(0, lastAt);
  const hostPart = rest.slice(lastAt + 1);
  const firstColon = credsPart.indexOf(":");
  if (firstColon === -1) throw new Error("MongoDB URI missing password");
  return {
    uriWithoutCreds: `${scheme}${hostPart}`,
    username: credsPart.slice(0, firstColon),
    password: credsPart.slice(firstColon + 1),
  };
}

async function connectMongoose(mongoose) {
  const srv = getEnvVar("MONGO_URI");
  const direct = getEnvVar("MONGO_URI_DIRECT");
  const opts = {
    dbName: "zudobot_saas",
    serverSelectionTimeoutMS: 15_000,
  };

  if (srv) {
    const passVariants = (password) => {
      const list = [password];
      try {
        const decoded = decodeURIComponent(password);
        if (decoded !== password) list.push(decoded);
      } catch {
        /* ignore */
      }
      return list;
    };

    try {
      await mongoose.connect(encodeMongoUri(srv), opts);
      console.log("✅  Connected via MONGO_URI (SRV, encoded URI)");
      return;
    } catch (err) {
      console.warn("⚠️  MONGO_URI encoded URI failed:", err instanceof Error ? err.message : err);
    }

    try {
      const { uriWithoutCreds, username, password } = parseUri(srv);
      let lastErr;
      for (const pass of passVariants(password)) {
        try {
          await mongoose.connect(uriWithoutCreds, {
            ...opts,
            user: decodeURIComponent(username),
            pass,
            authSource: "admin",
          });
          console.log("✅  Connected via MONGO_URI (SRV)");
          return;
        } catch (err) {
          lastErr = err;
        }
      }
      throw lastErr;
    } catch (err) {
      console.warn("⚠️  MONGO_URI failed:", err instanceof Error ? err.message : err);
    }
  }

  if (direct) {
    const { uriWithoutCreds, username, password } = parseUri(direct);
    const passCandidates = [password];
    try {
      const decoded = decodeURIComponent(password);
      if (decoded !== password) passCandidates.push(decoded);
    } catch {
      /* keep single candidate */
    }
    let lastErr;
    for (const pass of passCandidates) {
      try {
        await mongoose.connect(uriWithoutCreds, {
          ...opts,
          user: username,
          pass,
          authSource: "admin",
        });
        console.log("✅  Connected via MONGO_URI_DIRECT");
        return;
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr;
  }

  throw new Error("MONGO_URI and MONGO_URI_DIRECT not found in apps/web/.env.local");
}

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

const require = createRequire(import.meta.url);
const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true },
    name: String,
    role: { type: String, default: "tenant" },
    roles: { type: [String], default: ["tenant"] },
    tenantId: String,
    botState: { type: String, default: "active" },
    onboardingComplete: { type: Boolean, default: true },
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorVerified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

await connectMongoose(mongoose);

const db = mongoose.connection.db;
const users = db.collection("users");
const tenantprofiles = db.collection("tenantprofiles");

const existingProfile = await tenantprofiles.findOne({ tenantId: TENANT_ID });
if (existingProfile) {
  console.log("\n⚠️  tenantprofiles already exists for tenantId:", TENANT_ID);
  console.log("   embedKey:", existingProfile.embedKey);
  console.log("\n👉  PLATFORM_GLOBAL_CHAT_TENANT_ID=" + TENANT_ID);
  await mongoose.disconnect();
  process.exit(0);
}

const userOid = new mongoose.Types.ObjectId(TENANT_ID);
const existingUser = await users.findOne({ _id: userOid });
if (!existingUser) {
  await users.insertOne({
    _id: userOid,
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
  });
  console.log("✅  Inserted users document");
} else {
  console.log("ℹ️  users document already exists — skipped");
}

const insertResult = await tenantprofiles.insertOne(mockTenantProfile);
console.log("✅  Inserted tenantprofiles document");
console.log("   insertedId:", insertResult.insertedId.toString());
console.log("\n📋  Summary");
console.log("   tenantId :", TENANT_ID);
console.log("   embedKey :", EMBED_KEY);
console.log("\n👉  AWS Amplify:");
console.log("   PLATFORM_GLOBAL_CHAT_TENANT_ID=" + TENANT_ID);

await mongoose.disconnect();
console.log("\nDone.");
