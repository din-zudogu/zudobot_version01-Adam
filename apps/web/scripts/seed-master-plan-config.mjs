/**
 * Seed MasterPlanConfig collection from the master pricing table.
 * Run: node --env-file=.env.local scripts/seed-master-plan-config.mjs
 *  (from apps/web directory)
 *
 * All prices in THB excl. VAT.
 * VAT is always computed at runtime via computePlanFinancials().
 */
import mongoose from "mongoose";

const RAW_URI = process.env.MONGO_URI;
if (!RAW_URI) {
  console.error("❌ MONGO_URI not set.");
  process.exit(1);
}

// URL-encode credentials so special chars (@ ^ $) in password don't confuse the URI parser.
function encodeMongoUri(raw) {
  const protoEnd = raw.indexOf("://");
  if (protoEnd === -1) return raw;
  const proto = raw.slice(0, protoEnd + 3);
  const rest  = raw.slice(protoEnd + 3);
  const slashIdx = rest.indexOf("/");
  const authority = slashIdx >= 0 ? rest.slice(0, slashIdx) : rest;
  const suffix    = slashIdx >= 0 ? rest.slice(slashIdx)    : "";
  const atIdx = authority.lastIndexOf("@");
  if (atIdx === -1) return raw;
  const creds = authority.slice(0, atIdx);
  const host  = authority.slice(atIdx + 1);
  const colonIdx = creds.indexOf(":");
  const user  = colonIdx >= 0 ? creds.slice(0, colonIdx) : creds;
  const pass  = colonIdx >= 0 ? creds.slice(colonIdx + 1) : "";
  return `${proto}${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${host}${suffix}`;
}

const MONGO_URI = encodeMongoUri(RAW_URI);

// ── Schema (minimal copy for seed script) ─────────────────────────────────────

const schema = new mongoose.Schema({
  plan_code:            { type: String, required: true, unique: true },
  plan_category:        String,
  plan_tier:            String,
  billing_cycle_months: Number,
  label_th:             String,
  is_active:            { type: Boolean, default: true },
  sort_order:           Number,
  message_quota:        Number,
  extra_message_quota:  { type: Number, default: 0 },
  channel_connection_limit: { type: Number, default: 0 },
  support_level:        { type: String, default: "STANDARD" },
  has_custom_knowledge_base: { type: Boolean, default: false },
  retention_days:       { type: Number, default: 0 },
  retail_price:         Number,
  partner_cost:         Number,
  zudobot_internal_cost: Number,
  vat_rate:             { type: Number, default: 0.07 },
}, { timestamps: true });

const MasterPlanConfig = mongoose.models.MasterPlanConfig
  ?? mongoose.model("MasterPlanConfig", schema);

// ── Seed Data — sourced from Master Pricing Table (image) ─────────────────────
// All 24 records: 9 base plans + 9 quota addons + 6 retention addons.
// Derived fields (VAT, margins, profits) are NOT stored — computed at runtime.

const SEED_DATA = [

  // ════════════════════════════════════════════════════════════════════════════
  //  BASE PLAN — Starter
  //  msg: 1,000/mo | channels: 1 FB + 1 LINE (=2) | Support: Standard | KB: No
  // ════════════════════════════════════════════════════════════════════════════
  {
    plan_code: "base_starter_1m",   plan_category: "BASE_PLAN", plan_tier: "Starter",
    billing_cycle_months: 1,        label_th: "Starter รายเดือน",
    message_quota: 1000,            extra_message_quota: 0,
    channel_connection_limit: 2,    support_level: "STANDARD",
    has_custom_knowledge_base: false, retention_days: 7,
    retail_price: 1290,  partner_cost: 780,  zudobot_internal_cost: 280,
    vat_rate: 0.07,      sort_order: 101,
  },
  {
    plan_code: "base_starter_6m",   plan_category: "BASE_PLAN", plan_tier: "Starter",
    billing_cycle_months: 6,        label_th: "Starter 6 เดือน",
    message_quota: 1000,            extra_message_quota: 0,
    channel_connection_limit: 2,    support_level: "STANDARD",
    has_custom_knowledge_base: false, retention_days: 7,
    retail_price: 6970,  partner_cost: 4190, zudobot_internal_cost: 1630,
    vat_rate: 0.07,      sort_order: 102,
  },
  {
    plan_code: "base_starter_12m",  plan_category: "BASE_PLAN", plan_tier: "Starter",
    billing_cycle_months: 12,       label_th: "Starter 1 ปี",
    message_quota: 1000,            extra_message_quota: 0,
    channel_connection_limit: 2,    support_level: "STANDARD",
    has_custom_knowledge_base: false, retention_days: 7,
    retail_price: 12390, partner_cost: 7440, zudobot_internal_cost: 3210,
    vat_rate: 0.07,      sort_order: 103,
  },

  // ════════════════════════════════════════════════════════════════════════════
  //  BASE PLAN — Growth
  //  msg: 5,000/mo | channels: 3 FB + 3 LINE (=6) | Support: Priority | KB: No
  // ════════════════════════════════════════════════════════════════════════════
  {
    plan_code: "base_growth_1m",    plan_category: "BASE_PLAN", plan_tier: "Growth",
    billing_cycle_months: 1,        label_th: "Growth รายเดือน",
    message_quota: 5000,            extra_message_quota: 0,
    channel_connection_limit: 6,    support_level: "PRIORITY",
    has_custom_knowledge_base: false, retention_days: 7,
    retail_price: 2490,  partner_cost: 1500, zudobot_internal_cost: 550,
    vat_rate: 0.07,      sort_order: 201,
  },
  {
    plan_code: "base_growth_6m",    plan_category: "BASE_PLAN", plan_tier: "Growth",
    billing_cycle_months: 6,        label_th: "Growth 6 เดือน",
    message_quota: 5000,            extra_message_quota: 0,
    channel_connection_limit: 6,    support_level: "PRIORITY",
    has_custom_knowledge_base: false, retention_days: 7,
    retail_price: 13450, partner_cost: 8070, zudobot_internal_cost: 3260,
    vat_rate: 0.07,      sort_order: 202,
  },
  {
    plan_code: "base_growth_12m",   plan_category: "BASE_PLAN", plan_tier: "Growth",
    billing_cycle_months: 12,       label_th: "Growth 1 ปี",
    message_quota: 5000,            extra_message_quota: 0,
    channel_connection_limit: 6,    support_level: "PRIORITY",
    has_custom_knowledge_base: false, retention_days: 7,
    retail_price: 23910, partner_cost: 14350, zudobot_internal_cost: 6440,
    vat_rate: 0.07,      sort_order: 203,
  },

  // ════════════════════════════════════════════════════════════════════════════
  //  BASE PLAN — Pro
  //  msg: Unlimited (Fair Use 20k+) | channels: Unlimited | Support: Priority | KB: Yes
  // ════════════════════════════════════════════════════════════════════════════
  {
    plan_code: "base_pro_1m",       plan_category: "BASE_PLAN", plan_tier: "Pro",
    billing_cycle_months: 1,        label_th: "Pro รายเดือน",
    message_quota: -1,              extra_message_quota: 0,
    channel_connection_limit: -1,   support_level: "PRIORITY",
    has_custom_knowledge_base: true, retention_days: 7,
    retail_price: 4990,  partner_cost: 3000, zudobot_internal_cost: 1100,
    vat_rate: 0.07,      sort_order: 301,
  },
  {
    plan_code: "base_pro_6m",       plan_category: "BASE_PLAN", plan_tier: "Pro",
    billing_cycle_months: 6,        label_th: "Pro 6 เดือน",
    message_quota: -1,              extra_message_quota: 0,
    channel_connection_limit: -1,   support_level: "PRIORITY",
    has_custom_knowledge_base: true, retention_days: 7,
    retail_price: 26950, partner_cost: 16170, zudobot_internal_cost: 6520,
    vat_rate: 0.07,      sort_order: 302,
  },
  {
    plan_code: "base_pro_12m",      plan_category: "BASE_PLAN", plan_tier: "Pro",
    billing_cycle_months: 12,       label_th: "Pro 1 ปี",
    message_quota: -1,              extra_message_quota: 0,
    channel_connection_limit: -1,   support_level: "PRIORITY",
    has_custom_knowledge_base: true, retention_days: 7,
    retail_price: 47910, partner_cost: 28750, zudobot_internal_cost: 12900,
    vat_rate: 0.07,      sort_order: 303,
  },

  // ════════════════════════════════════════════════════════════════════════════
  //  QUOTA ADD-ON — +1,000 msg/month
  // ════════════════════════════════════════════════════════════════════════════
  {
    plan_code: "quota_1k_1m",       plan_category: "QUOTA_ADDON", plan_tier: "+1,000 msg",
    billing_cycle_months: 1,        label_th: "+1,000 ข้อความ/เดือน (รายเดือน)",
    message_quota: 0,               extra_message_quota: 1000,
    channel_connection_limit: 0,    support_level: "STANDARD",
    has_custom_knowledge_base: false, retention_days: 0,
    retail_price: 250,   partner_cost: 150,  zudobot_internal_cost: 60,
    vat_rate: 0.07,      sort_order: 401,
  },
  {
    plan_code: "quota_1k_6m",       plan_category: "QUOTA_ADDON", plan_tier: "+1,000 msg",
    billing_cycle_months: 6,        label_th: "+1,000 ข้อความ/เดือน (6 เดือน)",
    message_quota: 0,               extra_message_quota: 1000,
    channel_connection_limit: 0,    support_level: "STANDARD",
    has_custom_knowledge_base: false, retention_days: 0,
    retail_price: 1350,  partner_cost: 810,  zudobot_internal_cost: 360,
    vat_rate: 0.07,      sort_order: 402,
  },
  {
    plan_code: "quota_1k_12m",      plan_category: "QUOTA_ADDON", plan_tier: "+1,000 msg",
    billing_cycle_months: 12,       label_th: "+1,000 ข้อความ/เดือน (1 ปี)",
    message_quota: 0,               extra_message_quota: 1000,
    channel_connection_limit: 0,    support_level: "STANDARD",
    has_custom_knowledge_base: false, retention_days: 0,
    retail_price: 2400,  partner_cost: 1440, zudobot_internal_cost: 720,
    vat_rate: 0.07,      sort_order: 403,
  },

  // ════════════════════════════════════════════════════════════════════════════
  //  QUOTA ADD-ON — +5,000 msg/month
  // ════════════════════════════════════════════════════════════════════════════
  {
    plan_code: "quota_5k_1m",       plan_category: "QUOTA_ADDON", plan_tier: "+5,000 msg",
    billing_cycle_months: 1,        label_th: "+5,000 ข้อความ/เดือน (รายเดือน)",
    message_quota: 0,               extra_message_quota: 5000,
    channel_connection_limit: 0,    support_level: "STANDARD",
    has_custom_knowledge_base: false, retention_days: 0,
    retail_price: 690,   partner_cost: 420,  zudobot_internal_cost: 150,
    vat_rate: 0.07,      sort_order: 411,
  },
  {
    plan_code: "quota_5k_6m",       plan_category: "QUOTA_ADDON", plan_tier: "+5,000 msg",
    billing_cycle_months: 6,        label_th: "+5,000 ข้อความ/เดือน (6 เดือน)",
    message_quota: 0,               extra_message_quota: 5000,
    channel_connection_limit: 0,    support_level: "STANDARD",
    has_custom_knowledge_base: false, retention_days: 0,
    retail_price: 3730,  partner_cost: 2240, zudobot_internal_cost: 900,
    vat_rate: 0.07,      sort_order: 412,
  },
  {
    plan_code: "quota_5k_12m",      plan_category: "QUOTA_ADDON", plan_tier: "+5,000 msg",
    billing_cycle_months: 12,       label_th: "+5,000 ข้อความ/เดือน (1 ปี)",
    message_quota: 0,               extra_message_quota: 5000,
    channel_connection_limit: 0,    support_level: "STANDARD",
    has_custom_knowledge_base: false, retention_days: 0,
    retail_price: 6630,  partner_cost: 3980, zudobot_internal_cost: 1800,
    vat_rate: 0.07,      sort_order: 413,
  },

  // ════════════════════════════════════════════════════════════════════════════
  //  QUOTA ADD-ON — +20,000 msg/month
  // ════════════════════════════════════════════════════════════════════════════
  {
    plan_code: "quota_20k_1m",      plan_category: "QUOTA_ADDON", plan_tier: "+20,000 msg",
    billing_cycle_months: 1,        label_th: "+20,000 ข้อความ/เดือน (รายเดือน)",
    message_quota: 0,               extra_message_quota: 20000,
    channel_connection_limit: 0,    support_level: "STANDARD",
    has_custom_knowledge_base: false, retention_days: 0,
    retail_price: 2290,  partner_cost: 1380, zudobot_internal_cost: 500,
    vat_rate: 0.07,      sort_order: 421,
  },
  {
    plan_code: "quota_20k_6m",      plan_category: "QUOTA_ADDON", plan_tier: "+20,000 msg",
    billing_cycle_months: 6,        label_th: "+20,000 ข้อความ/เดือน (6 เดือน)",
    message_quota: 0,               extra_message_quota: 20000,
    channel_connection_limit: 0,    support_level: "STANDARD",
    has_custom_knowledge_base: false, retention_days: 0,
    retail_price: 12370, partner_cost: 7430, zudobot_internal_cost: 3000,
    vat_rate: 0.07,      sort_order: 422,
  },
  {
    plan_code: "quota_20k_12m",     plan_category: "QUOTA_ADDON", plan_tier: "+20,000 msg",
    billing_cycle_months: 12,       label_th: "+20,000 ข้อความ/เดือน (1 ปี)",
    message_quota: 0,               extra_message_quota: 20000,
    channel_connection_limit: 0,    support_level: "STANDARD",
    has_custom_knowledge_base: false, retention_days: 0,
    retail_price: 21990, partner_cost: 13200, zudobot_internal_cost: 6000,
    vat_rate: 0.07,      sort_order: 423,
  },

  // ════════════════════════════════════════════════════════════════════════════
  //  RETENTION ADD-ON — 30 วัน (vs standard 7 วัน)
  // ════════════════════════════════════════════════════════════════════════════
  {
    plan_code: "ret_30d_1m",        plan_category: "RETENTION_ADDON", plan_tier: "30 Days",
    billing_cycle_months: 1,        label_th: "เก็บข้อมูล 30 วัน (รายเดือน)",
    message_quota: 0,               extra_message_quota: 0,
    channel_connection_limit: 0,    support_level: "STANDARD",
    has_custom_knowledge_base: false, retention_days: 30,
    retail_price: 350,   partner_cost: 210,  zudobot_internal_cost: 60,
    vat_rate: 0.07,      sort_order: 501,
  },
  {
    plan_code: "ret_30d_6m",        plan_category: "RETENTION_ADDON", plan_tier: "30 Days",
    billing_cycle_months: 6,        label_th: "เก็บข้อมูล 30 วัน (6 เดือน)",
    message_quota: 0,               extra_message_quota: 0,
    channel_connection_limit: 0,    support_level: "STANDARD",
    has_custom_knowledge_base: false, retention_days: 30,
    retail_price: 1890,  partner_cost: 1140, zudobot_internal_cost: 360,
    vat_rate: 0.07,      sort_order: 502,
  },
  {
    plan_code: "ret_30d_12m",       plan_category: "RETENTION_ADDON", plan_tier: "30 Days",
    billing_cycle_months: 12,       label_th: "เก็บข้อมูล 30 วัน (1 ปี)",
    message_quota: 0,               extra_message_quota: 0,
    channel_connection_limit: 0,    support_level: "STANDARD",
    has_custom_knowledge_base: false, retention_days: 30,
    retail_price: 3360,  partner_cost: 2020, zudobot_internal_cost: 720,
    vat_rate: 0.07,      sort_order: 503,
  },

  // ════════════════════════════════════════════════════════════════════════════
  //  RETENTION ADD-ON — 90 วัน
  // ════════════════════════════════════════════════════════════════════════════
  {
    plan_code: "ret_90d_1m",        plan_category: "RETENTION_ADDON", plan_tier: "90 Days",
    billing_cycle_months: 1,        label_th: "เก็บข้อมูล 90 วัน (รายเดือน)",
    message_quota: 0,               extra_message_quota: 0,
    channel_connection_limit: 0,    support_level: "STANDARD",
    has_custom_knowledge_base: false, retention_days: 90,
    retail_price: 790,   partner_cost: 480,  zudobot_internal_cost: 120,
    vat_rate: 0.07,      sort_order: 511,
  },
  {
    plan_code: "ret_90d_6m",        plan_category: "RETENTION_ADDON", plan_tier: "90 Days",
    billing_cycle_months: 6,        label_th: "เก็บข้อมูล 90 วัน (6 เดือน)",
    message_quota: 0,               extra_message_quota: 0,
    channel_connection_limit: 0,    support_level: "STANDARD",
    has_custom_knowledge_base: false, retention_days: 90,
    retail_price: 4270,  partner_cost: 2570, zudobot_internal_cost: 720,
    vat_rate: 0.07,      sort_order: 512,
  },
  {
    plan_code: "ret_90d_12m",       plan_category: "RETENTION_ADDON", plan_tier: "90 Days",
    billing_cycle_months: 12,       label_th: "เก็บข้อมูล 90 วัน (1 ปี)",
    message_quota: 0,               extra_message_quota: 0,
    channel_connection_limit: 0,    support_level: "STANDARD",
    has_custom_knowledge_base: false, retention_days: 90,
    retail_price: 7590,  partner_cost: 4560, zudobot_internal_cost: 1440,
    vat_rate: 0.07,      sort_order: 513,
  },
];

// ── Run ────────────────────────────────────────────────────────────────────────

async function main() {
  await mongoose.connect(MONGO_URI);
  console.log("✅ Connected to MongoDB\n");

  let inserted = 0;
  let updated  = 0;
  let errors   = 0;

  for (const record of SEED_DATA) {
    try {
      const result = await MasterPlanConfig.updateOne(
        { plan_code: record.plan_code },
        { $set: record },     // $set = upsert with full overwrite (idempotent re-run)
        { upsert: true }
      );
      if (result.upsertedCount > 0) {
        console.log(`  ➕ inserted  ${record.plan_code}`);
        inserted++;
      } else if (result.modifiedCount > 0) {
        console.log(`  ✏️  updated   ${record.plan_code}`);
        updated++;
      } else {
        console.log(`  ─  no-change ${record.plan_code}`);
      }
    } catch (err) {
      console.error(`  ❌ error     ${record.plan_code}:`, err.message);
      errors++;
    }
  }

  const total = await MasterPlanConfig.countDocuments();
  console.log("\n════════════════════════════════");
  console.log(`Inserted : ${inserted}`);
  console.log(`Updated  : ${updated}`);
  console.log(`Errors   : ${errors}`);
  console.log(`Total DB : ${total} records`);
  console.log("════════════════════════════════");
  await mongoose.disconnect();
  console.log("🔌 Disconnected");
}

main().catch((err) => { console.error(err); process.exit(1); });
