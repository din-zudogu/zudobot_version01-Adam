/**
 * ลบ account ออกจากระบบแบบถาวร (ใช้ AWS Amplify credentials)
 *
 * Usage:
 *   node scripts/delete-account-now.mjs work.luesat.d@gmail.com          # dry-run
 *   node scripts/delete-account-now.mjs work.luesat.d@gmail.com --live   # ลบจริง
 */

import mongoose from "mongoose";
import { connectMongoose, loadMongoEnv } from "./lib/mongo-connect.mjs";

const TARGET_EMAIL    = (process.argv[2] ?? "").trim().toLowerCase();
const DRY_RUN         = !process.argv.includes("--live");
const PROTECTED_EMAIL = "zudogu.official@gmail.com";
const DB_NAME         = process.env.MONGO_DB_NAME || "zudobot_saas";

if (!TARGET_EMAIL) {
  console.error("Usage: node scripts/delete-account-now.mjs <email> [--live]");
  process.exit(1);
}
if (TARGET_EMAIL === PROTECTED_EMAIL) {
  console.error("❌ ไม่สามารถลบบัญชี super admin ได้");
  process.exit(1);
}

// ── Load env + Connect ────────────────────────────────────────────────────────
// ถ้า MONGO_URI ถูก set อยู่แล้ว (ผ่าน $env:MONGO_URI) ใช้ทันทีโดยไม่ต้องผ่าน Amplify
if (process.env.MONGO_URI) {
  console.log("\nใช้ MONGO_URI จาก environment variable โดยตรง");
  await mongoose.connect(process.env.MONGO_URI, {
    dbName: DB_NAME,
    serverSelectionTimeoutMS: 15_000,
  });
} else {
  // ไม่มี MONGO_URI ในเครื่อง → โหลดจาก AWS Amplify (ต้องมี aws credentials)
  const meta = await loadMongoEnv();
  console.log(`\nAmplify env: ${meta.source} (branch: ${meta.branch})`);
  await connectMongoose();
}
console.log(`Connected to: ${DB_NAME}`);
console.log(`\nTarget : ${TARGET_EMAIL}`);
console.log(`Mode   : ${DRY_RUN ? "🔬 DRY-RUN" : "⚠️  LIVE — ลบจริง"}\n`);

const db = mongoose.connection.db;

// ── Helpers ───────────────────────────────────────────────────────────────────
function toObjectIds(ids) {
  return ids
    .filter((id) => typeof id === "string" && mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));
}

async function countOrDelete(collName, query) {
  const cols = (await db.listCollections({ name: collName }).toArray()).map((c) => c.name);
  const actual = cols[0];
  if (!actual) {
    console.log(`  ⏩ ข้าม: '${collName}' (collection ไม่มี)`);
    return 0;
  }
  const coll  = db.collection(actual);
  const count = await coll.countDocuments(query);
  if (count === 0) { console.log(`  ✅ ${collName}: ว่าง`); return 0; }
  console.log(`  📂 ${collName}: ${count} doc`);
  if (!DRY_RUN) {
    const r = await coll.deleteMany(query);
    console.log(`     💥 ลบแล้ว ${r.deletedCount}`);
  }
  return count;
}

// ── Step 1: หา User ───────────────────────────────────────────────────────────
const usersCol = db.collection("users");
const user = await usersCol.findOne({ email: TARGET_EMAIL });

if (!user) {
  console.log(`ℹ️  ไม่พบ user: ${TARGET_EMAIL}\n   อาจถูกลบไปแล้ว`);
  await mongoose.disconnect();
  process.exit(0);
}

const userId    = user._id.toString();
const tenantId  = user.tenantId ?? userId;
const tenantIds = [...new Set([userId, tenantId].filter(Boolean))];
const oids      = toObjectIds(tenantIds);

console.log(`✅ พบ User:`);
console.log(`   id:       ${userId}`);
console.log(`   name:     ${user.name ?? "-"}`);
console.log(`   role:     ${user.role}`);
console.log(`   tenantId: ${tenantId}\n`);

// ── Step 2: หา PartnerProfile ─────────────────────────────────────────────────
const partnerCol = db.collection("partnerprofiles");
const partner    = await partnerCol.findOne({ $or: [{ userId }, { email: TARGET_EMAIL }] }).catch(() => null);
const partnerId  = partner?._id?.toString() ?? null;
if (partner) console.log(`🤝 พบ PartnerProfile: ${partnerId} (${partner.companyName})\n`);

// ── Queries ───────────────────────────────────────────────────────────────────
const tenantQ = oids.length > 0
  ? { $or: [{ tenantId: { $in: tenantIds } }, { tenantId: { $in: oids } }] }
  : { tenantId: { $in: tenantIds } };
const tenantStrQ = { tenantId: { $in: tenantIds } };
const vipQ       = { $or: [{ email: TARGET_EMAIL }, tenantStrQ] };

// ── Step 3: Delete cascade ────────────────────────────────────────────────────
console.log("--- collections ---");
let total = 0;

// Chat
total += await countOrDelete("conversationsessions",   tenantQ);
total += await countOrDelete("chatsessions",           tenantQ);

// Knowledge
total += await countOrDelete("knowledgechunks",        tenantStrQ);
total += await countOrDelete("knowledgejobs",          tenantStrQ);
total += await countOrDelete("knowledgebases",         tenantStrQ);
total += await countOrDelete("knowledgegaps",          tenantStrQ);

// Memory / Visitor
total += await countOrDelete("customermemories",       tenantStrQ);
total += await countOrDelete("visitorprofiles",        tenantStrQ);
total += await countOrDelete("visitormemoryentries",   tenantStrQ);
total += await countOrDelete("fewshotexamples",        { ...tenantStrQ, isGlobal: { $ne: true } });

// Bot / Config
total += await countOrDelete("zudobotconfigs",         tenantStrQ);
total += await countOrDelete("botconfigs",             tenantStrQ);
total += await countOrDelete("configs",                tenantStrQ);
total += await countOrDelete("customcommands",         tenantStrQ);
total += await countOrDelete("rageventlogs",           tenantStrQ);
total += await countOrDelete("ruleviolations",         tenantStrQ);
total += await countOrDelete("products",               tenantStrQ);

// Billing
total += await countOrDelete("subscriptions",          tenantStrQ);
total += await countOrDelete("invoices",               tenantStrQ);
total += await countOrDelete("kycsubmissions",         tenantStrQ);
total += await countOrDelete("notifications",          tenantStrQ);
total += await countOrDelete("tenantpurchases",        tenantStrQ);
total += await countOrDelete("tenantusages",           tenantStrQ);
total += await countOrDelete("packageconfigs",         tenantStrQ);

// VIP
total += await countOrDelete("viptenants",             vipQ);

// Partner sub-collections
if (partnerId) {
  total += await countOrDelete("partnerinvoices",      { partnerId });
  total += await countOrDelete("partnerlegalprofiles", { partnerId });
  total += await countOrDelete("partnerclientdatas",   { $or: [{ partnerId }, tenantStrQ] });
  total += await countOrDelete("partnerprofiles",      { $or: [{ userId }, { email: TARGET_EMAIL }] });
}

// Tenant
total += await countOrDelete("tenantprofiles",         { tenantId: { $in: tenantIds } });
total += await countOrDelete("tenants",                { _id: { $in: oids } });

// NextAuth adapter
total += await countOrDelete("accounts",               { userId });
total += await countOrDelete("sessions",               { userId });
total += await countOrDelete("verificationtokens",     { identifier: TARGET_EMAIL });

// User (สุดท้าย)
console.log(`\n  📂 users: 1 doc`);
if (!DRY_RUN) {
  await usersCol.deleteOne({ email: TARGET_EMAIL });
  console.log(`     💥 ลบแล้ว 1`);
}
total += 1;

// ── Guard: super admin ยังอยู่ ────────────────────────────────────────────────
const owner = await usersCol.findOne({ email: PROTECTED_EMAIL });
if (!owner) {
  console.error("\n❌ CRITICAL: super admin หายไป — หยุดทันที");
  process.exit(2);
}
console.log(`\n🛡️  Super admin ยังอยู่: ${owner.email}`);

// ── Summary ───────────────────────────────────────────────────────────────────
console.log("\n==================================================");
console.log(`รวม: ~${total} documents`);
if (DRY_RUN) {
  console.log("💡 DRY-RUN เสร็จ — ยังไม่ได้ลบ");
  console.log(`👉 ลบจริง: node scripts/delete-account-now.mjs ${TARGET_EMAIL} --live`);
} else {
  console.log(`✅ ลบ ${TARGET_EMAIL} ออกจากระบบเรียบร้อย`);
}
console.log("==================================================\n");

await mongoose.disconnect();
