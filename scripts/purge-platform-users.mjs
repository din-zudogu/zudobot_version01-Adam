/**
 * Zudobot — Purge all user accounts except platform owner (standalone script).
 *
 * Usage:
 *   node scripts/purge-platform-users.mjs           # DRY-RUN (default)
 *   node scripts/purge-platform-users.mjs --live    # DELETE for real
 *
 * Env: MONGO_URI / MONGO_URI_DIRECT from AWS Amplify only (no local .env)
 * DB:  zudobot_saas
 *
 * NEVER commit credentials. Review dry-run output before --live.
 */

import { ObjectId } from "mongodb";
import { connectMongoClient, loadMongoEnv } from "./lib/mongo-connect.mjs";

const DRY_RUN = !process.argv.includes("--live");
const DB_NAME = process.env.MONGO_DB_NAME || "zudobot_saas";
const WHITE_LIST_EMAIL = "zudogu.official@gmail.com".toLowerCase();
const OWNER_ROLE = "super_admin";

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
  const names = (await db.listCollections({ name: collectionName }).toArray()).map((c) => c.name);
  const actual = names.find((n) => n === collectionName) ?? names.find((n) => n.toLowerCase() === collectionName.toLowerCase());
  if (!actual) {
    console.log(`⏩ ข้าม: ไม่พบ collection '${collectionName}'`);
    return { collection: collectionName, found: false, count: 0, deleted: 0 };
  }
  const coll = db.collection(actual);
  const count = await coll.countDocuments(query);
  console.log(`📂 [${actual}]: ${count} รายการ`);
  let deleted = 0;
  if (count > 0 && !dryRun) {
    const result = await coll.deleteMany(query);
    deleted = result.deletedCount ?? 0;
    console.log(`   💥 ลบจริง ${deleted} รายการ`);
  }
  return { collection: actual, found: true, count, deleted };
}

async function runPurge() {
  console.log("==== 🚀 Zudobot — Purge platform users ====");
  console.log(`DB: ${DB_NAME}`);
  console.log(
    `Mode: ${DRY_RUN ? "🔬 DRY-RUN (ไม่แก้ข้อมูล)" : "⚠️ LIVE — ลบข้อมูลจริง"}`
  );
  console.log(`Whitelist: ${WHITE_LIST_EMAIL} (${OWNER_ROLE})\n`);

  const meta = await loadMongoEnv();
  console.log(`Env: ${meta.source} | branch ${meta.branch} | app ${meta.appId}\n`);

  const { client, mode } = await connectMongoClient();
  console.log(`Connected: ${mode}\n`);
  const db = client.db(DB_NAME);

  try {
    const users = db.collection("users");

    // ── 1. Protect owner ─────────────────────────────────────────────────────
    let owner = await users.findOne({ email: WHITE_LIST_EMAIL });
    if (!owner) {
      console.log(`ℹ️  ไม่พบ ${WHITE_LIST_EMAIL} — dry-run จะไม่สร้าง; ใช้ --live + create-admin ก่อนหากต้องการ`);
    } else {
      console.log(`✅ พบบัญชีหลัก: ${owner.email} (_id=${owner._id}) role=${owner.role}`);
      if (!DRY_RUN) {
        await users.updateOne(
          { _id: owner._id },
          {
            $set: {
              role: OWNER_ROLE,
              roles: [OWNER_ROLE],
              onboardingComplete: true,
              updatedAt: new Date(),
            },
          }
        );
        owner = await users.findOne({ _id: owner._id });
        console.log(`👑 อัปเดต role เป็น ${OWNER_ROLE} แล้ว`);
      }
    }

    const ownerId = owner?._id?.toString();
    const ownerTenantId = owner?.tenantId ?? ownerId;

    // ── 2. Users to remove ───────────────────────────────────────────────────
    const targetUsers = await users.find({ email: { $ne: WHITE_LIST_EMAIL } }).toArray();
    const targetUserIds = targetUsers
      .map((u) => u._id.toString())
      .filter((id) => id !== ownerId);
    const targetEmails = targetUsers.map((u) => u.email).filter(Boolean);

    const tenantIdSet = new Set();
    for (const u of targetUsers) {
      if (u._id.toString() === ownerId) continue;
      const tid = u.tenantId || u._id.toString();
      if (tid && tid !== ownerTenantId && tid !== ownerId) tenantIdSet.add(tid);
    }
    const targetTenantIds = [...tenantIdSet];

    console.log(`\n📊 Users ที่จะลบ: ${targetUsers.length}`);
    if (targetUsers.length > 0) {
      console.log("   Emails:");
      for (const e of targetEmails) console.log(`   - ${e}`);
    }
    console.log(`   Tenant IDs ที่เกี่ยวข้อง: ${targetTenantIds.length}`);

    if (targetUsers.length === 0) {
      console.log("\n🎉 ไม่มีบัญชีอื่นให้ลบ");
      return;
    }

    // Partner profiles for target users
    const partnerProfiles = db.collection("partnerprofiles");
    const partnerList = (await partnerProfiles
      .find({
        $or: [{ userId: { $in: targetUserIds } }, { email: { $in: targetEmails } }],
      })
      .toArray()
      .catch(() => [])) ?? [];
    const partnerIds = partnerList.map((p) => p._id.toString());

    const tenantQ = tenantIdQuery(targetTenantIds);
    const tenantOidQ = { _id: { $in: toObjectIds(targetTenantIds) } };

    const purgeSteps = [
      { name: "knowledgechunks", query: tenantQ },
      { name: "knowledgejobs", query: tenantQ },
      { name: "conversationsessions", query: tenantQ },
      { name: "chatsessions", query: tenantQ },
      { name: "products", query: tenantQ },
      { name: "notifications", query: tenantQ },
      { name: "invoices", query: tenantQ },
      { name: "kycsubmissions", query: tenantQ },
      { name: "configs", query: tenantQ },
      { name: "partnerinvoices", query: tenantQ },
      { name: "zudobotglobalbackups", query: tenantQ },
      {
        name: "subscriptions",
        query: {
          $or: [
            tenantQ,
            ...(partnerIds.length ? [{ referredByPartnerId: { $in: partnerIds } }] : []),
          ],
        },
      },
      {
        name: "partnerclientdatas",
        query: {
          $or: [
            ...(partnerIds.length ? [{ partnerId: { $in: partnerIds } }] : []),
            ...(targetTenantIds.length ? [tenantQ] : []),
          ],
        },
      },
      ...(partnerIds.length
        ? [{ name: "partnerlegalprofiles", query: { partnerId: { $in: partnerIds } } }]
        : []),
      {
        name: "partnerprofiles",
        query: {
          $or: [{ userId: { $in: targetUserIds } }, { email: { $in: targetEmails } }],
        },
      },
      { name: "tenantprofiles", query: { tenantId: { $in: targetTenantIds } } },
      // Legacy API collections (ObjectId tenant refs)
      { name: "tenants", query: tenantOidQ },
      { name: "botconfigs", query: tenantQ },
      { name: "knowledgebases", query: tenantQ },
      { name: "knowledgegaps", query: tenantQ },
      { name: "tenantpurchases", query: tenantQ },
      { name: "tenantusages", query: tenantQ },
      { name: "visitorprofiles", query: tenantQ },
      { name: "visitormemoryentries", query: tenantQ },
      { name: "customcommands", query: tenantQ },
      { name: "ruleviolations", query: tenantQ },
      // NextAuth MongoDB adapter (if present)
      { name: "accounts", query: { userId: { $in: targetUserIds } } },
      { name: "sessions", query: { userId: { $in: targetUserIds } } },
      // Users last
      { name: "users", query: { email: { $ne: WHITE_LIST_EMAIL } } },
    ];

    console.log("\n--- ⏱️ ประมวลผลตาม collection ---\n");
    const summary = [];
    for (const step of purgeSteps) {
      if (
        step.name === "partnerclientdatas" &&
        !partnerIds.length &&
        !targetTenantIds.length
      ) {
        continue;
      }
      if (step.name === "subscriptions" && !targetTenantIds.length && !partnerIds.length) {
        continue;
      }
      const row = await countOrDelete(db, step.name, step.query, DRY_RUN);
      summary.push(row);
    }

    // Safety: whitelist must still exist
    const ownerAfter = await users.findOne({ email: WHITE_LIST_EMAIL });
    if (!ownerAfter) {
      console.error("\n❌ CRITICAL: บัญชี whitelist หายหลังรัน — หยุดทันที");
      process.exit(2);
    }
    if (ownerAfter._id.toString() === ownerId || !ownerId) {
      console.log(`\n🛡️  Whitelist ยังอยู่: ${ownerAfter.email} (role=${ownerAfter.role})`);
    }

    const totalWouldDelete = summary.filter((s) => s.found).reduce((a, s) => a + s.count, 0);
    console.log("\n==================================================");
    console.log(`สรุป: ${summary.filter((s) => s.found).length} collections, ~${totalWouldDelete} documents`);
    if (DRY_RUN) {
      console.log("💡 DRY-RUN เสร็จ — ไม่มีข้อมูลถูกลบ");
      console.log("👉 ลบจริง: node scripts/purge-platform-users.mjs --live");
    } else {
      console.log("✅ LIVE purge เสร็จ (ตรวจสอบ whitelist ด้านบน)");
    }
    console.log("==================================================\n");
  } finally {
    await client.close();
  }
}

runPurge().catch((err) => {
  console.error("❌", err);
  process.exit(1);
});
