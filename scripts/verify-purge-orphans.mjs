/**
 * Verify (and optionally purge) orphaned documents left behind by an account
 * that was hard-deleted through an OLDER version of hardDeleteTenant() —
 * before it was consolidated to cover all collections (see git history on
 * lib/admin/tenantActions.ts). Takes tenantId + email directly since the
 * User doc itself is already gone, so there's nothing to look up by email
 * alone.
 *
 * Usage:
 *   node scripts/verify-purge-orphans.mjs <tenantId> <email>          # dry-run
 *   node scripts/verify-purge-orphans.mjs <tenantId> <email> --live   # purge
 */

import mongoose from "mongoose";
import { connectMongoose, loadMongoEnv } from "./lib/mongo-connect.mjs";

const TARGET_TENANT_ID = (process.argv[2] ?? "").trim();
const TARGET_EMAIL      = (process.argv[3] ?? "").trim().toLowerCase();
const DRY_RUN           = !process.argv.includes("--live");
const PROTECTED_EMAIL   = "zudogu.official@gmail.com";
const DB_NAME           = process.env.MONGO_DB_NAME || "zudobot_saas";

if (!TARGET_TENANT_ID || !TARGET_EMAIL) {
  console.error("Usage: node scripts/verify-purge-orphans.mjs <tenantId> <email> [--live]");
  process.exit(1);
}
if (TARGET_EMAIL === PROTECTED_EMAIL) {
  console.error("❌ ปฏิเสธ: ห้ามแตะบัญชี super admin");
  process.exit(1);
}

if (process.env.MONGO_URI) {
  console.log("\nใช้ MONGO_URI จาก environment variable โดยตรง");
  await mongoose.connect(process.env.MONGO_URI, { dbName: DB_NAME, serverSelectionTimeoutMS: 15_000 });
} else {
  const meta = await loadMongoEnv();
  console.log(`\nAmplify env: ${meta.source} (branch: ${meta.branch})`);
  await connectMongoose();
}
console.log(`Connected to: ${DB_NAME}`);
console.log(`\nTarget tenantId : ${TARGET_TENANT_ID}`);
console.log(`Target email    : ${TARGET_EMAIL}`);
console.log(`Mode            : ${DRY_RUN ? "🔬 DRY-RUN" : "⚠️  LIVE — ลบจริง"}\n`);

const db = mongoose.connection.db;

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
  console.log(`  ⚠️  ${collName}: พบ ${count} doc ตกค้าง`);
  if (!DRY_RUN) {
    const r = await coll.deleteMany(query);
    console.log(`     💥 ลบแล้ว ${r.deletedCount}`);
  }
  return count;
}

// ── Step 0: confirm the User doc is genuinely gone ─────────────────────────
const usersCol = db.collection("users");
const existingUser = await usersCol.findOne({
  $or: [{ email: TARGET_EMAIL }, { _id: toObjectIds([TARGET_TENANT_ID])[0] }],
});
if (existingUser) {
  console.error(`\n❌ พบ User document อยู่จริง (${existingUser.email}) — บัญชีนี้ยังไม่ถูกลบ หยุดสคริปต์`);
  await mongoose.disconnect();
  process.exit(2);
}
console.log("✅ ยืนยันแล้ว: ไม่มี User document สำหรับ tenantId/email นี้\n");

const tenantIds = [TARGET_TENANT_ID];
const oids      = toObjectIds(tenantIds);
const tenantQ    = oids.length > 0
  ? { $or: [{ tenantId: { $in: tenantIds } }, { tenantId: { $in: oids } }] }
  : { tenantId: { $in: tenantIds } };
const tenantStrQ = { tenantId: { $in: tenantIds } };
const vipQ       = { $or: [{ email: TARGET_EMAIL }, tenantStrQ] };

console.log("--- ตรวจสอบทุก collection ที่เกี่ยวข้อง ---");
let total = 0;

total += await countOrDelete("conversationsessions",   tenantQ);
total += await countOrDelete("chatsessions",           tenantQ);
total += await countOrDelete("knowledgechunks",        tenantStrQ);
total += await countOrDelete("knowledgejobs",          tenantStrQ);
total += await countOrDelete("knowledgebases",         tenantStrQ);
total += await countOrDelete("knowledgegaps",          tenantStrQ);
total += await countOrDelete("customermemories",       tenantStrQ);
total += await countOrDelete("visitorprofiles",        tenantStrQ);
total += await countOrDelete("visitormemoryentries",   tenantStrQ);
total += await countOrDelete("fewshotexamples",        { ...tenantStrQ, isGlobal: { $ne: true } });
total += await countOrDelete("zudobotconfigs",         tenantStrQ);
total += await countOrDelete("botconfigs",             tenantStrQ);
total += await countOrDelete("configs",                tenantStrQ);
total += await countOrDelete("customcommands",         tenantStrQ);
total += await countOrDelete("rageventlogs",           tenantStrQ);
total += await countOrDelete("ruleviolations",         tenantStrQ);
total += await countOrDelete("products",               tenantStrQ);
total += await countOrDelete("subscriptions",          tenantStrQ);
total += await countOrDelete("invoices",               tenantStrQ);
total += await countOrDelete("kycsubmissions",         tenantStrQ);
total += await countOrDelete("notifications",          tenantStrQ);
total += await countOrDelete("tenantpurchases",        tenantStrQ);
total += await countOrDelete("tenantusages",           tenantStrQ);
total += await countOrDelete("packageconfigs",         tenantStrQ);
total += await countOrDelete("viptenants",             vipQ);
total += await countOrDelete("tenantprofiles",         { tenantId: { $in: tenantIds } });
total += await countOrDelete("tenants",                { _id: { $in: oids } });
total += await countOrDelete("accounts",               { userId: TARGET_TENANT_ID });
total += await countOrDelete("sessions",               { userId: TARGET_TENANT_ID });
total += await countOrDelete("verificationtokens",     { identifier: TARGET_EMAIL });

// ── Guard: super admin ยังอยู่ ────────────────────────────────────────────────
const owner = await usersCol.findOne({ email: PROTECTED_EMAIL });
if (!owner) {
  console.error("\n❌ CRITICAL: super admin หายไป — ตรวจสอบด่วน");
} else {
  console.log(`\n🛡️  Super admin ยังอยู่: ${owner.email}`);
}

console.log("\n==================================================");
console.log(`รวมพบตกค้าง: ~${total} documents`);
if (DRY_RUN) {
  console.log("💡 DRY-RUN เสร็จ — ยังไม่ได้ลบ");
  if (total > 0) {
    console.log(`👉 ลบจริง: node scripts/verify-purge-orphans.mjs ${TARGET_TENANT_ID} ${TARGET_EMAIL} --live`);
  }
} else {
  console.log(`✅ ล้างข้อมูลตกค้างของ ${TARGET_EMAIL} เรียบร้อย`);
}
console.log("==================================================\n");

await mongoose.disconnect();
