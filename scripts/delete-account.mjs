/**
 * Zudobot — ลบข้อมูลทั้งหมดของ 1 email account ออกจากระบบ
 *
 * Usage:
 *   node scripts/delete-account.mjs              # DRY-RUN (ดูก่อน ไม่ลบจริง)
 *   node scripts/delete-account.mjs --live       # ลบจริง
 *
 * อ่าน MONGO_URI จาก apps/web/.env.local (ถ้าไม่ได้ set ใน env)
 * DB:  zudobot_saas
 */

import { MongoClient, ObjectId } from "mongodb";
import fs from "node:fs";
import path from "node:path";
import dns from "node:dns";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TARGET_EMAIL    = "work.luesat.d@gmail.com".toLowerCase();
const PROTECTED_EMAIL = "zudogu.official@gmail.com".toLowerCase();
const DRY_RUN         = !process.argv.includes("--live");
const DB_NAME         = "zudobot_saas";

// ─── Load .env.local ──────────────────────────────────────────────────────────

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf-8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const k = trimmed.slice(0, eq).trim();
    const v = trimmed.slice(eq + 1).trim();
    if (k && !process.env[k]) process.env[k] = v;
  }
}

// root .env.local มี URI ที่ encode แล้ว (Z%5E...) — load ก่อน
loadDotEnv(path.join(__dirname, "..", ".env.local"));
// apps/web .env.local มี URI ที่ยังไม่ encode — ใช้เป็น fallback
if (!process.env.MONGO_URI) {
  loadDotEnv(path.join(__dirname, "..", "apps", "web", ".env.local"));
}

// ─── URI encode helper ────────────────────────────────────────────────────────

/** encode เฉพาะกรณีที่ password ยังไม่ถูก encode (ไม่มี %) */
function safeEncodeMongoUri(uri) {
  const m = uri.match(/^(mongodb(?:\+srv)?:\/\/)/);
  if (!m) return uri;
  const scheme = m[1];
  const rest   = uri.slice(scheme.length);
  const lastAt = rest.lastIndexOf("@");
  if (lastAt === -1) return uri;
  const creds       = rest.slice(0, lastAt);
  const hostAndMore = rest.slice(lastAt + 1);
  const firstColon  = creds.indexOf(":");
  if (firstColon === -1) return uri;
  const user     = creds.slice(0, firstColon);
  const password = creds.slice(firstColon + 1);
  // ถ้า password ยังมี @ หรือ ^ หรือ $ (ไม่ encode) ให้ encode
  const needsEncode = /[@^$]/.test(password) && !password.includes("%");
  const encodedPass = needsEncode ? encodeURIComponent(password) : password;
  return `${scheme}${user}:${encodedPass}@${hostAndMore}`;
}

// ─── Connect MongoDB ──────────────────────────────────────────────────────────

async function connect() {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);

  const srv    = process.env.MONGO_URI?.trim();
  const direct = process.env.MONGO_URI_DIRECT?.trim();

  if (!srv && !direct) {
    throw new Error("MONGO_URI ไม่พบ — ตรวจสอบ .env.local");
  }

  const errors = [];

  if (srv) {
    // ลอง URI ตรงๆ ก่อน (กรณีที่ encode แล้ว)
    for (const uri of [srv, safeEncodeMongoUri(srv)]) {
      try {
        const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15_000 });
        await client.connect();
        await client.db(DB_NAME).command({ ping: 1 });
        return { client, mode: "SRV (MONGO_URI)" };
      } catch (e) {
        errors.push(`SRV[${uri === srv ? "raw" : "encoded"}]: ${e.message}`);
      }
    }
  }

  if (direct) {
    for (const uri of [direct, safeEncodeMongoUri(direct)]) {
      try {
        const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15_000 });
        await client.connect();
        await client.db(DB_NAME).command({ ping: 1 });
        return { client, mode: "DIRECT (MONGO_URI_DIRECT)" };
      } catch (e) {
        errors.push(`DIRECT[${uri === direct ? "raw" : "encoded"}]: ${e.message}`);
      }
    }
  }

  throw new Error(`MongoDB connect failed:\n  ${errors.join("\n  ")}`);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toObjectIds(ids) {
  return ids
    .filter((id) => typeof id === "string" && ObjectId.isValid(id))
    .map((id) => new ObjectId(id));
}

function tenantIdQuery(tenantIds) {
  const oids = toObjectIds(tenantIds);
  if (oids.length === 0) return { tenantId: { $in: tenantIds } };
  return { $or: [{ tenantId: { $in: tenantIds } }, { tenantId: { $in: oids } }] };
}

async function countOrDelete(db, collectionName, query, dryRun) {
  const cols  = (await db.listCollections({ name: collectionName }).toArray()).map((c) => c.name);
  const actual = cols.find((n) => n === collectionName)
    ?? cols.find((n) => n.toLowerCase() === collectionName.toLowerCase());
  if (!actual) {
    console.log(`⏩ ข้าม: ไม่พบ collection '${collectionName}'`);
    return { collection: collectionName, found: false, count: 0, deleted: 0 };
  }
  const coll  = db.collection(actual);
  const count = await coll.countDocuments(query);
  console.log(`📂 [${actual}]: ${count} รายการ`);
  let deleted = 0;
  if (count > 0 && !dryRun) {
    const res = await coll.deleteMany(query);
    deleted   = res.deletedCount ?? 0;
    console.log(`   💥 ลบจริง ${deleted} รายการ`);
  }
  return { collection: actual, found: true, count, deleted };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  console.log("==== 🗑️  Zudobot — Delete Account ====");
  console.log(`Target:  ${TARGET_EMAIL}`);
  console.log(`DB:      ${DB_NAME}`);
  console.log(`Mode:    ${DRY_RUN ? "🔬 DRY-RUN (ไม่แก้ข้อมูล)" : "⚠️  LIVE — ลบข้อมูลจริง"}\n`);

  if (TARGET_EMAIL === PROTECTED_EMAIL) {
    console.error("❌ ไม่สามารถลบบัญชี super admin ได้");
    process.exit(1);
  }

  const { client, mode } = await connect();
  console.log(`Connected: ${mode}\n`);
  const db = client.db(DB_NAME);

  try {
    // ── Step 1: หา User ─────────────────────────────────────────────────────
    const usersCol = db.collection("users");
    const user     = await usersCol.findOne({ email: TARGET_EMAIL });

    if (!user) {
      console.log(`ℹ️  ไม่พบ user ที่มี email: ${TARGET_EMAIL}`);
      console.log("   ระบบอาจลบไปแล้ว หรืออีเมล์นี้ไม่เคยลงทะเบียน");
      return;
    }

    const userId   = user._id.toString();
    const tenantId = user.tenantId ?? userId;
    const tenantIds = [...new Set([userId, tenantId].filter(Boolean))];

    console.log("✅ พบ User:");
    console.log(`   _id:       ${userId}`);
    console.log(`   email:     ${user.email}`);
    console.log(`   name:      ${user.name ?? "-"}`);
    console.log(`   role:      ${user.role} / roles: [${(user.roles ?? []).join(", ")}]`);
    console.log(`   botState:  ${user.botState ?? "-"}`);
    console.log(`   tenantIds: [${tenantIds.join(", ")}]\n`);

    // ── Step 2: หา PartnerProfile ────────────────────────────────────────────
    const partnerProfilesCol = db.collection("partnerprofiles");
    const partnerProfile = await partnerProfilesCol
      .findOne({ $or: [{ userId }, { email: TARGET_EMAIL }] })
      .catch(() => null);
    const partnerId  = partnerProfile?._id?.toString();
    const partnerIds = partnerId ? [partnerId] : [];

    if (partnerProfile) {
      console.log(`🤝 พบ PartnerProfile:`);
      console.log(`   partnerId:   ${partnerId}`);
      console.log(`   companyName: ${partnerProfile.companyName}`);
      console.log(`   status:      ${partnerProfile.status}\n`);
    } else {
      console.log("ℹ️  ไม่พบ PartnerProfile\n");
    }

    // ── Step 3: Build purge steps ────────────────────────────────────────────
    const tenantQ    = tenantIdQuery(tenantIds);
    const tenantOidQ = { _id: { $in: toObjectIds(tenantIds) } };

    const steps = [
      // Chat / Session
      { name: "conversationsessions",    query: tenantQ },
      { name: "chatsessions",            query: tenantQ },

      // Knowledge / KB
      { name: "knowledgechunks",         query: tenantQ },
      { name: "knowledgejobs",           query: tenantQ },
      { name: "knowledgebases",          query: tenantQ },
      { name: "knowledgegaps",           query: tenantQ },

      // Visitor / Memory
      { name: "visitorprofiles",         query: tenantQ },
      { name: "visitormemoryentries",    query: tenantQ },
      { name: "customermemories",        query: tenantQ },
      { name: "fewshotexamples",         query: { ...tenantQ, isGlobal: { $ne: true } } },

      // Bot / Config
      { name: "botconfigs",              query: tenantQ },
      { name: "configs",                 query: tenantQ },
      { name: "customcommands",          query: tenantQ },
      { name: "zudobotconfigs",          query: tenantQ },
      { name: "ruleviolations",          query: tenantQ },
      { name: "rageventlogs",            query: tenantQ },
      { name: "products",                query: tenantQ },

      // Billing / Packages
      { name: "notifications",           query: tenantQ },
      { name: "invoices",                query: tenantQ },
      { name: "kycsubmissions",          query: tenantQ },
      { name: "subscriptions",           query: { $or: [
        tenantQ,
        ...(partnerIds.length ? [{ referredByPartnerId: { $in: partnerIds } }] : []),
      ]}},
      { name: "tenantpurchases",         query: tenantQ },
      { name: "tenantusages",            query: tenantQ },
      { name: "packageconfigs",          query: tenantQ },
      { name: "zudobotglobalbackups",    query: tenantQ },

      // VIP
      { name: "viptenants",              query: { $or: [{ email: TARGET_EMAIL }, tenantQ] } },

      // Partner sub-collections
      ...(partnerIds.length ? [
        { name: "partnerinvoices",       query: { partnerId: { $in: partnerIds } } },
        { name: "partnerlegalprofiles",  query: { partnerId: { $in: partnerIds } } },
        { name: "partnerclientdatas",    query: {
          $or: [{ partnerId: { $in: partnerIds } }, tenantQ],
        }},
      ] : []),
      { name: "partnerprofiles",         query: { $or: [{ userId }, { email: TARGET_EMAIL }] } },

      // TenantProfile + API Tenant
      { name: "tenantprofiles",          query: { tenantId: { $in: tenantIds } } },
      { name: "tenants",                 query: tenantOidQ },

      // NextAuth adapter
      { name: "accounts",                query: { userId } },
      { name: "sessions",                query: { userId } },
      { name: "verificationtokens",      query: { identifier: TARGET_EMAIL } },

      // User (สุดท้าย)
      { name: "users",                   query: { email: TARGET_EMAIL } },
    ];

    console.log("--- ⏱️  ประมวลผลตาม collection ---\n");
    const summary = [];
    for (const step of steps) {
      const row = await countOrDelete(db, step.name, step.query, DRY_RUN);
      summary.push(row);
    }

    // ── ตรวจสอบ super admin ยังอยู่ ─────────────────────────────────────────
    const ownerStillExists = await usersCol.findOne({ email: PROTECTED_EMAIL });
    if (!ownerStillExists) {
      console.error("\n❌ CRITICAL: super admin หายไปหลังรัน — หยุดทันที");
      process.exit(2);
    }
    console.log(`\n🛡️  Super admin ยังอยู่: ${ownerStillExists.email}`);

    const totalDocs = summary.filter((s) => s.found).reduce((a, s) => a + s.count, 0);
    console.log("\n==================================================");
    console.log(`สรุป: ${summary.filter((s) => s.found).length} collections, ~${totalDocs} documents`);
    if (DRY_RUN) {
      console.log("💡 DRY-RUN เสร็จ — ไม่มีข้อมูลถูกลบ");
      console.log("👉 ลบจริง: node scripts/delete-account.mjs --live");
    } else {
      console.log(`✅ LIVE delete เสร็จ — ${TARGET_EMAIL} ถูกลบออกจากระบบแล้ว`);
    }
    console.log("==================================================\n");

  } finally {
    await client.close();
  }
}

run().catch((err) => {
  console.error("❌", err);
  process.exit(1);
});
