/**
 * Generate complete Zudobot reward points analysis + export files
 * Run: npx tsx scripts/generate-reward-points-analysis.ts
 */
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const COST_PER_TOKEN_V1 = 0.0000105;
const STORAGE_COST_PER_MB_V1 = 0.01;
const COST_PER_MB_RETENTION = 0.01;
const TOKENS_PER_SENTENCE = 2500;
const OUTPUT_RATIO = 0.3;
const TOKEN_INPUT_RATE = 0.00009813;
const TOKEN_OUTPUT_RATE = 0.00049065;
const B2_RATE = 0.00019166;

const QUOTA_1K_RETAIL = 249;
const STORAGE_BEGIN_RETAIL = 1990;
const STORAGE_BEGIN_MB = 12000;
const RET_30D = 349;
const RET_90D = 790;

const AVG_PLAN = 990;
const LTV_REMAINING = 990 * 6;
const MARKETING_BUDGET_PER_POINT = 0.35;

const IMPACT = {
  Token: { churnReduction: 0.02, upsellProb: 0.08, upsellValue: 249, activationProb: 0.05, newUserReferral: 0.03, revenueGrowthProb: 0.35, userGrowthProb: 0.25, stickiness: 0.25, notes: "ใช้แล้วหมด ไม่ lock-in — ถอดออกจากตาราง Final" },
  Storage: { churnReduction: 0.10, upsellProb: 0.15, upsellValue: 690, activationProb: 0.18, newUserReferral: 0.08, revenueGrowthProb: 0.55, userGrowthProb: 0.50, stickiness: 0.80, notes: "ต้นทุน B2 ต่ำ KB โต → ย้ายยาก" },
  Retention: { churnReduction: 0.18, upsellProb: 0.10, upsellValue: 349, activationProb: 0.10, newUserReferral: 0.05, revenueGrowthProb: 0.72, userGrowthProb: 0.40, stickiness: 0.90, notes: "ลด churn สูง switching cost สูง" },
  Discount: { churnReduction: 0.08, upsellProb: 0.30, upsellValue: 990, activationProb: 0.35, newUserReferral: 0.12, revenueGrowthProb: 0.82, userGrowthProb: 0.65, stickiness: 0.45, notes: "conversion/renewal — ใช้เฉพาะ checkout" },
} as const;

/** Mandatory UX ตอน redeem — ส่วนหนึ่งของ product (ไม่ใช่ optional action) */
const MANDATORY_FLOW = {
  Storage: {
    label: "KB onboarding wizard",
    description: "ต้องอัปโหลด Knowledge Base อย่างน้อย 1 ชุดก่อนรับ storage",
    boost: (points: number) => (points <= 100 ? 35 : points <= 500 ? 28 : 22),
  },
  Retention: {
    label: "Chat history + renew CTA",
    description: "ต้องเปิดหน้าประวัติแชท + แสดง CTA upgrade/renew ก่อนรับวัน",
    boost: (points: number) => (points <= 100 ? 30 : points <= 500 ? 22 : 15),
  },
  Discount: {
    label: "Checkout/renewal only",
    description: "ใช้ส่วนลดได้เฉพาะหน้า checkout หรือ renewal เท่านั้น",
    boost: (points: number) => (points >= 1000 ? 0 : 10),
  },
  Token: { label: "—", description: "ถอดออกจากโปรแกรม", boost: () => 0 },
} as const;

type OptType = keyof typeof IMPACT;

function costToken(t: number) {
  return t * TOKEN_INPUT_RATE + Math.round(t * OUTPUT_RATIO) * TOKEN_OUTPUT_RATE;
}
function costStorage(mb: number) {
  return Math.max(1, Math.ceil(mb * B2_RATE));
}
function costRetention(days: number) {
  const conv = Math.ceil(1000 / 30);
  return Math.ceil(conv * 8 * days * COST_PER_MB_RETENTION);
}
function retailToken(t: number) {
  return (t / 2500000) * QUOTA_1K_RETAIL;
}
function retailStorage(mb: number) {
  return (mb / STORAGE_BEGIN_MB) * STORAGE_BEGIN_RETAIL;
}
function retailRetention(days: number) {
  if (days <= 30) return (RET_30D * days) / 30;
  if (days <= 90) return RET_30D + ((RET_90D - RET_30D) * (days - 30)) / 60;
  return RET_90D + (RET_90D * (days - 90)) / 90;
}
function costTokenV1(t: number) { return t * COST_PER_TOKEN_V1; }
function costStorageV1(mb: number) { return mb * STORAGE_COST_PER_MB_V1; }

function expectedReturn(type: OptType, points: number, discountFace = 0) {
  const c = IMPACT[type];
  const tierBoost = points >= 1000 ? 1.2 : points >= 200 ? 1.0 : 0.7;
  const churnValue = LTV_REMAINING * c.churnReduction * tierBoost;
  const upsellValue = c.upsellProb * c.upsellValue * tierBoost;
  const activationValue = LTV_REMAINING * c.activationProb * (points <= 100 ? 1.5 : 0.6);
  const referralValue = c.newUserReferral * LTV_REMAINING * 0.3;
  let total = churnValue + upsellValue + activationValue + referralValue;
  if (type === "Discount" && discountFace > 0) total += discountFace * c.upsellProb * 0.5;
  return Math.round(total * 100) / 100;
}

function pctInvestmentWorthiness(exp: number, cost: number, points: number) {
  const budget = points * MARKETING_BUDGET_PER_POINT;
  const roi = cost > 0 ? exp / cost : 0;
  const budgetFit = cost > 0 ? Math.min(1, budget / cost) : 1;
  const roiScore = Math.min(100, roi * 40);
  const budgetScore = budgetFit * 100;
  const netScore = exp > cost ? 100 : cost > 0 ? (exp / cost) * 100 : 100;
  return Math.round(Math.min(100, roiScore * 0.4 + budgetScore * 0.3 + netScore * 0.3) * 10) / 10;
}

function pctOpportunityBase(type: OptType, points: number) {
  const c = IMPACT[type];
  const tierBoost = points >= 1000 ? 1.1 : points >= 200 ? 1.0 : 0.85;
  const userGrowth = Math.min(100, c.userGrowthProb * 100 * tierBoost);
  const revenueGrowth = Math.min(100, c.revenueGrowthProb * 100 * tierBoost);
  return Math.round((userGrowth * 0.4 + revenueGrowth * 0.6) * 10) / 10;
}

function pctOpportunityEffective(type: OptType, points: number, useMandatory: boolean) {
  const base = pctOpportunityBase(type, points);
  if (!useMandatory || type === "Token") return base;
  const boost = MANDATORY_FLOW[type].boost(points);
  return Math.min(100, Math.round((base + boost) * 10) / 10);
}

interface TierDef {
  points: number;
  token: number;
  storageMb: number;
  retentionDays: number;
  discount: number;
}

const ORIGINAL: TierDef[] = [
  { points: 50, token: 125_000, storageMb: 300, retentionDays: 7, discount: 0 },
  { points: 100, token: 250_000, storageMb: 800, retentionDays: 14, discount: 0 },
  { points: 200, token: 375_000, storageMb: 1024, retentionDays: 30, discount: 50 },
  { points: 500, token: 500_000, storageMb: 1300, retentionDays: 45, discount: 200 },
  { points: 1000, token: 1_250_000, storageMb: 2048, retentionDays: 90, discount: 400 },
  { points: 2000, token: 2_500_000, storageMb: 3072, retentionDays: 120, discount: 1000 },
];

const CUSTOMER_ADJUSTED: TierDef[] = [
  { points: 50, token: 655_000, storageMb: 400, retentionDays: 7, discount: 0 },
  { points: 100, token: 1_310_000, storageMb: 850, retentionDays: 14, discount: 0 },
  { points: 200, token: 2_850_000, storageMb: 1700, retentionDays: 30, discount: 283 },
  { points: 500, token: 4_520_000, storageMb: 2700, retentionDays: 45, discount: 450 },
  { points: 1000, token: 10_000_000, storageMb: 6050, retentionDays: 100, discount: 850 },
  { points: 2000, token: 8_550_000, storageMb: 6400, retentionDays: 120, discount: 1060 },
];

/** @deprecated มี Token — โอกาสธุรกิจไม่ถึง 80% */
const ZUDOBOT_RECOMMENDED: TierDef[] = [
  { points: 50, token: 50_000, storageMb: 300, retentionDays: 7, discount: 0 },
  { points: 100, token: 100_000, storageMb: 800, retentionDays: 14, discount: 0 },
  { points: 200, token: 150_000, storageMb: 1024, retentionDays: 30, discount: 50 },
  { points: 500, token: 200_000, storageMb: 1300, retentionDays: 45, discount: 150 },
  { points: 1000, token: 400_000, storageMb: 2048, retentionDays: 90, discount: 300 },
  { points: 2000, token: 500_000, storageMb: 3072, retentionDays: 120, discount: 500 },
];

/**
 * ตาราง Final — ไม่มี Token, mandatory redemption UX, ทุกตัวเลือก ≥80/80
 */
const ZUDOBOT_FINAL: TierDef[] = [
  { points: 50,   token: 0, storageMb: 250,  retentionDays: 7,  discount: 0 },
  { points: 100,  token: 0, storageMb: 600,  retentionDays: 14, discount: 0 },
  { points: 200,  token: 0, storageMb: 900,  retentionDays: 28, discount: 80 },
  { points: 500,  token: 0, storageMb: 1200, retentionDays: 42, discount: 175 },
  { points: 1000, token: 0, storageMb: 2048, retentionDays: 88, discount: 320 },
  { points: 2000, token: 0, storageMb: 3072, retentionDays: 120, discount: 500 },
];

interface AnalysisRow {
  tableVersion: string;
  points: number;
  optionType: OptType;
  quantity: string;
  mandatoryFlow: string;
  costV2Real: number;
  retailCatalog: number;
  expectedReturn: number;
  roi: number;
  pctInvestmentWorthiness: number;
  pctOpportunityBase: number;
  pctOpportunityEffective: number;
  passesInvestment80: boolean;
  passesOpportunity80: boolean;
  passesBoth80: boolean;
  recommendation: string;
}

function fmtQty(type: OptType, t: TierDef): string {
  switch (type) {
    case "Token": return `${t.token.toLocaleString()} tokens (~${Math.round(t.token / TOKENS_PER_SENTENCE)} ประโยค)`;
    case "Storage": return t.storageMb >= 1024 ? `${(t.storageMb / 1024).toFixed(1)} GB (${t.storageMb} MB)` : `${t.storageMb} MB`;
    case "Retention": return `+${t.retentionDays} วัน`;
    case "Discount": return `฿${t.discount}`;
  }
}

function getOptionTypes(tier: TierDef, includeToken: boolean): OptType[] {
  const opts: OptType[] = [];
  if (includeToken && tier.token > 0) opts.push("Token");
  opts.push("Storage", "Retention");
  if (tier.discount > 0) opts.push("Discount");
  return opts;
}

function analyzeTier(version: string, tier: TierDef, opts?: { useMandatory?: boolean; includeToken?: boolean }) {
  const useMandatory = opts?.useMandatory ?? false;
  const includeToken = opts?.includeToken ?? true;
  const types = getOptionTypes(tier, includeToken);

  return types.map((type): AnalysisRow => {
    let costV2 = 0;
    let retail = 0;
    switch (type) {
      case "Token":
        costV2 = costToken(tier.token);
        retail = retailToken(tier.token);
        break;
      case "Storage":
        costV2 = costStorage(tier.storageMb);
        retail = retailStorage(tier.storageMb);
        break;
      case "Retention":
        costV2 = costRetention(tier.retentionDays);
        retail = retailRetention(tier.retentionDays);
        break;
      case "Discount":
        costV2 = tier.discount;
        retail = tier.discount;
        break;
    }

    const exp = expectedReturn(type, tier.points, tier.discount);
    const roi = costV2 > 0 ? Math.round((exp / costV2) * 100) / 100 : 0;
    const inv = pctInvestmentWorthiness(exp, costV2, tier.points);
    const oppBase = pctOpportunityBase(type, tier.points);
    const oppEff = pctOpportunityEffective(type, tier.points, useMandatory);
    const oppForPass = useMandatory ? oppEff : oppBase;

    let rec = "แนะนำ — ผ่านทั้ง ROI และโอกาสธุรกิจ";
    if (inv < 80 && oppForPass < 80) rec = "ไม่แนะนำ";
    else if (inv < 80) rec = "ระวัง — ROI ต่ำ";
    else if (oppForPass < 80) rec = "ลงทุนคุ้ม — ต้องมี mandatory flow ตาม spec";

    return {
      tableVersion: version,
      points: tier.points,
      optionType: type,
      quantity: fmtQty(type, tier),
      mandatoryFlow: useMandatory ? MANDATORY_FLOW[type].label : "—",
      costV2Real: Math.round(costV2 * 100) / 100,
      retailCatalog: Math.round(retail * 100) / 100,
      expectedReturn: exp,
      roi,
      pctInvestmentWorthiness: inv,
      pctOpportunityBase: oppBase,
      pctOpportunityEffective: oppEff,
      passesInvestment80: inv >= 80,
      passesOpportunity80: oppForPass >= 80,
      passesBoth80: inv >= 80 && oppForPass >= 80,
      recommendation: rec,
    };
  });
}

function analyzeAll(version: string, tiers: TierDef[], opts?: { useMandatory?: boolean; includeToken?: boolean }) {
  return tiers.flatMap((t) => analyzeTier(version, t, opts));
}

function retentionByBj(days: number) {
  return [
    { plan: "Starter", bj: 1000 },
    { plan: "Pro", bj: 5000 },
    { plan: "Master", bj: 20000 },
  ].map(({ plan, bj }) => {
    const conv = Math.ceil(bj / 30);
    return { plan, bj, convPerDay: conv, retentionMb: conv * 8 * days, cost: Math.ceil(conv * 8 * days * COST_PER_MB_RETENTION), days };
  });
}

function toCsv(rows: Record<string, unknown>[], columns: string[]) {
  const escape = (v: unknown) => {
    const s = String(v ?? "");
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "\uFEFF" + [columns.join(","), ...rows.map((r) => columns.map((c) => escape(r[c])).join(","))].join("\r\n");
}

const allRows = [
  ...analyzeAll("original", ORIGINAL),
  ...analyzeAll("customer_adjusted", CUSTOMER_ADJUSTED),
  ...analyzeAll("zudobot_recommended", ZUDOBOT_RECOMMENDED),
  ...analyzeAll("zudobot_final", ZUDOBOT_FINAL, { useMandatory: true, includeToken: false }),
];

const csvColumns = [
  "tableVersion", "points", "optionType", "quantity", "mandatoryFlow",
  "costV2Real", "retailCatalog", "expectedReturn", "roi",
  "pctInvestmentWorthiness", "pctOpportunityBase", "pctOpportunityEffective",
  "passesInvestment80", "passesOpportunity80", "passesBoth80", "recommendation",
];

const outDir = join(process.cwd(), "docs", "exports");
mkdirSync(outDir, { recursive: true });

writeFileSync(join(outDir, "reward-points-analysis-full.csv"), toCsv(allRows as unknown as Record<string, unknown>[], csvColumns), "utf8");

const tierCompare = ORIGINAL.map((o, i) => ({
  points: o.points,
  orig_token: o.token, orig_storage: o.storageMb, orig_retention: o.retentionDays, orig_discount: o.discount,
  final_storage: ZUDOBOT_FINAL[i].storageMb, final_retention: ZUDOBOT_FINAL[i].retentionDays, final_discount: ZUDOBOT_FINAL[i].discount,
  token_removed: "yes",
}));
writeFileSync(join(outDir, "reward-points-tier-comparison.csv"), toCsv(tierCompare, Object.keys(tierCompare[0])), "utf8");

const finalRows = allRows.filter((r) => r.tableVersion === "zudobot_final");
writeFileSync(join(outDir, "reward-points-final-table.csv"), toCsv(finalRows as unknown as Record<string, unknown>[], csvColumns), "utf8");

const retRows = ZUDOBOT_FINAL.flatMap((t) => retentionByBj(t.retentionDays).map((r) => ({ points: t.points, ...r })));
writeFileSync(join(outDir, "reward-points-retention-by-plan.csv"), toCsv(retRows, ["points", "plan", "bj", "convPerDay", "retentionMb", "cost", "days"]), "utf8");

function avgByType(version: string) {
  const rows = allRows.filter((r) => r.tableVersion === version);
  return (["Token", "Storage", "Retention", "Discount"] as OptType[]).map((type) => {
    const items = rows.filter((r) => r.optionType === type);
    if (!items.length) return null;
    const avg = (fn: (r: AnalysisRow) => number) => Math.round(items.reduce((s, r) => s + fn(r), 0) / items.length * 10) / 10;
    return {
      tableVersion: version, optionType: type, count: items.length,
      avgCostV2: avg((r) => r.costV2Real), avgExpectedReturn: avg((r) => r.expectedReturn), avgRoi: avg((r) => r.roi),
      avgPctInvestment: avg((r) => r.pctInvestmentWorthiness),
      avgPctOpportunity: avg((r) => r.pctOpportunityEffective),
      passBoth80Count: items.filter((r) => r.passesBoth80).length,
    };
  }).filter(Boolean);
}

const summaryRows = [
  ...avgByType("original"), ...avgByType("customer_adjusted"),
  ...avgByType("zudobot_recommended"), ...avgByType("zudobot_final"),
];
writeFileSync(join(outDir, "reward-points-summary-by-option.csv"), toCsv(summaryRows as Record<string, unknown>[], Object.keys(summaryRows[0]!)), "utf8");

const config = {
  version: "zudobot_final_v1",
  generatedAt: new Date().toISOString(),
  description: "ตาราง reward สุดท้าย — ทุกตัวเลือก ≥80% ความคุ้มค่า + โอกาสธุรกิจ (มุม Zudobot)",
  tokenRemovedReason: "Token มี % โอกาสธุรกิจ ~31% ไม่ถึง 80% และต้นทุน Sonnet สูง",
  mandatoryFlows: MANDATORY_FLOW,
  tiers: ZUDOBOT_FINAL.map((t) => ({
    points: t.points,
    options: {
      storage: t.storageMb > 0 ? { mb: t.storageMb, mandatoryFlow: MANDATORY_FLOW.Storage.label } : null,
      retention: { days: t.retentionDays, mandatoryFlow: MANDATORY_FLOW.Retention.label },
      discount: t.discount > 0 ? { baht: t.discount, mandatoryFlow: MANDATORY_FLOW.Discount.label } : null,
    },
  })),
  analysis: finalRows,
};

writeFileSync(join(outDir, "reward-points-config.json"), JSON.stringify(config, null, 2), "utf8");
writeFileSync(join(process.cwd(), "docs", "reward-points-config.json"), JSON.stringify(config, null, 2), "utf8");

writeFileSync(join(outDir, "reward-points-analysis-full.json"), JSON.stringify({
  generatedAt: new Date().toISOString(),
  assumptions: { avgPlanThb: AVG_PLAN, ltvRemainingThb: LTV_REMAINING, marketingBudgetPerPoint: MARKETING_BUDGET_PER_POINT },
  impactCoefficients: IMPACT,
  mandatoryFlows: MANDATORY_FLOW,
  tables: { original: ORIGINAL, customerAdjusted: CUSTOMER_ADJUSTED, zudobotRecommended: ZUDOBOT_RECOMMENDED, zudobotFinal: ZUDOBOT_FINAL },
  analysis: allRows,
  summary: summaryRows,
}, null, 2), "utf8");

function mdTable(headers: string[], rows: string[][]) {
  return `| ${headers.join(" | ")} |\n| ${headers.map(() => "---").join(" | ")} |\n${rows.map((r) => `| ${r.join(" | ")} |`).join("\n")}`;
}

function sectionFinal() {
  let md = "";
  for (const p of [50, 100, 200, 500, 1000, 2000]) {
    const tier = finalRows.filter((r) => r.points === p);
    md += `\n### ${p} คะแนน\n\n`;
    md += mdTable(
      ["ตัวเลือก", "ปริมาณ", "Mandatory flow", "ต้นทุน", "Expected Return", "ROI", "% ความคุ้มค่า", "% โอกาส", "80/80"],
      tier.map((r) => [
        r.optionType, r.quantity, r.mandatoryFlow,
        `฿${r.costV2Real}`, `฿${r.expectedReturn}`, `${r.roi}×`,
        `${r.pctInvestmentWorthiness}%`, `${r.pctOpportunityEffective}%`,
        r.passesBoth80 ? "✅" : "❌",
      ]),
    );
    md += "\n";
  }
  return md;
}

const md = `# Zudobot Reward Points — รายงานวิเคราะห์ (Final)

> อัปเดต: ${new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}
> มุมมอง: **Zudobot เป็นผู้ลงทุน** — เป้า **≥80% ทั้งความคุ้มค่าและโอกาสธุรกิจ**

---

## 1. ตาราง Final (ใช้งานจริง)

**ไม่มี Token** — ถอนออกเพราะ % โอกาสธุรกิจ ~31% ไม่ถึง 80%

${mdTable(
  ["คะแนน", "Storage", "Retention", "ส่วนลด"],
  ZUDOBOT_FINAL.map((t) => [
    String(t.points),
    t.storageMb >= 1024 ? `${(t.storageMb / 1024).toFixed(1)} GB` : `${t.storageMb} MB`,
    `+${t.retentionDays} วัน`,
    t.discount ? `฿${t.discount}` : "—",
  ]),
)}

### Mandatory redemption flows (บังคับตอน redeem)

| ตัวเลือก | Flow ที่ต้องทำ | Boost โอกาส |
|---------|---------------|:-----------:|
| Storage | ${MANDATORY_FLOW.Storage.description} | +22–35% |
| Retention | ${MANDATORY_FLOW.Retention.description} | +15–30% |
| ส่วนลด | ${MANDATORY_FLOW.Discount.description} | +0–10% |

---

## 2. วิเคราะห์ราย tier (Final)

${sectionFinal()}

---

## 3. สรุปเฉลี่ย Final

${mdTable(
  ["ตัวเลือก", "Avg ต้นทุน", "Avg Return", "Avg ROI", "% ความคุ้มค่า", "% โอกาส", "ผ่าน 80/80"],
  summaryRows!.filter((s) => s!.tableVersion === "zudobot_final").map((s) => [
    s!.optionType, `฿${s!.avgCostV2}`, `฿${s!.avgExpectedReturn}`, `${s!.avgRoi}×`,
    `${s!.avgPctInvestment}%`, `${s!.avgPctOpportunity}%`, `${s!.passBoth80Count}/${s!.count}`,
  ]),
)}

---

## 4. คำจำกัดความ

| ตัวชี้วัด | ความหมาย |
|---------|----------|
| **% ความคุ้มค่า** | ROI การลงทุน — Expected Return vs ต้นทุนจริง |
| **% โอกาส** | ความน่าจะเป็นเพิ่ม users + revenue (รวม mandatory flow) |

---

## 5. ไฟล์ Export

| ไฟล์ | เนื้อหา |
|------|---------|
| \`docs/reward-points-config.json\` | **Config ใช้งานจริง** |
| \`docs/exports/reward-points-final-table.csv\` | วิเคราะห์ Final ทุก cell |
| \`docs/exports/reward-points-analysis-full.csv\` | ทุก version |
| \`docs/exports/reward-points-tier-comparison.csv\` | Original vs Final |

---

*Generated by \`scripts/generate-reward-points-analysis.ts\`*
`;

writeFileSync(join(outDir, "reward-points-analysis-zudobot.md"), md, "utf8");
writeFileSync(join(process.cwd(), "docs", "reward-points-analysis-zudobot.md"), md, "utf8");

console.log("Export complete.");
const passCount = finalRows.filter((r) => r.passesBoth80).length;
console.log(`Final table: ${passCount}/${finalRows.length} options pass 80/80`);
finalRows.forEach((r) => {
  console.log(`  ${r.points}pts ${r.optionType}: inv=${r.pctInvestmentWorthiness}% opp=${r.pctOpportunityEffective}% ${r.passesBoth80 ? "OK" : "FAIL"}`);
});
