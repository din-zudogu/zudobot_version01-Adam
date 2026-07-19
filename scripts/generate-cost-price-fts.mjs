/**
 * Generate FTS markdown v1.2.0 from ODS/XLSX analysis JSON.
 * Usage: node scripts/analyze-cost-price-ods.mjs [source.xlsx]
 *        node scripts/generate-cost-price-fts.mjs [source.xlsx]
 */
import { createRequire } from "module";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(__dirname, "../apps/web/package.json"));
const XLSX = require("xlsx");

const VERSION = "1.2.0";
const DOC_ID = `FTS-ZUDOBOT-COSTPRICE-20260529-v${VERSION}`;
const DEFAULT_XLSX =
  "C:/Users/luesa/Downloads/Zudobot_Calculate_Cost&Price-20260529.xlsx";

const xlsxPath = process.argv[2] || DEFAULT_XLSX;
const analysisPath = path.join(__dirname, "../docs/_ods_analysis_temp.json");

if (!fs.existsSync(analysisPath)) {
  console.error("Run first: node scripts/analyze-cost-price-ods.mjs", xlsxPath);
  process.exit(1);
}

const analysis = JSON.parse(fs.readFileSync(analysisPath, "utf8"));
const wb = fs.existsSync(xlsxPath) ? XLSX.readFile(xlsxPath, { cellFormula: true }) : null;
const xws = wb ? wb.Sheets[wb.SheetNames[0]] : null;

const COL_ORDER = Object.keys(analysis.headers).sort(
  (a, b) => analysis.headers[a].colIndex - analysis.headers[b].colIndex,
);

function esc(s) {
  return String(s ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\n/g, " / ")
    .trim();
}

function ynToBool(v) {
  const s = String(v ?? "").trim().toUpperCase();
  return s === "Y" || s === "YES" || s === "TRUE" || s === "1";
}

function cellVal(row, col) {
  return xws?.[`${col}${row}`]?.v;
}

function formulaBlock(patterns) {
  const formulas = patterns.filter((p) => p.formulaTemplate);
  if (!formulas.length) return "_ไม่มีสูตร — กรอกค่ามือ (Manual Input)_";
  return formulas
    .map((p) => {
      const tmpl = p.formulaTemplate
        .replace(/\$\$([A-Z]+)\$REF/g, "$$$1$<base>")
        .replace(/N/g, "r");
      return `- \`${tmpl}\` — **${p.count}** แถว (ตัวอย่าง: ${p.sampleRows.join(", ")})`;
    })
    .join("\n");
}

function inputBlock(patterns) {
  const vals = patterns.filter((p) => p.isManualInput);
  if (!vals.length) return "";
  const samples = [...new Set(vals.map((v) => JSON.stringify(v.sampleValue)))].slice(0, 12);
  return `\n\n**ค่าที่พบในไฟล์ (Manual):** ${samples.map((s) => s.replace(/^"|"$/g, "")).join(", ")}`;
}

function planCategory(plan, baseAddon) {
  const pl = String(plan || "").toLowerCase();
  if (pl.includes("trial") || String(baseAddon).toLowerCase().includes("trial"))
    return "Trial";
  if (pl.includes("storage")) return "Storage Add-on";
  if (pl.includes("expired")) return "Expired Add-on";
  if (pl.includes("ai base") || baseAddon === "Base") return "AI Base";
  return "อื่นๆ";
}

function buildPackageDescription(r) {
  const cat = planCategory(r.plan, r.baseAddon);
  const months = r.aiBaseMonthsF;
  const days = r.storageExpireDays;
  const bj = cellVal(r.row, "BJ");
  const parts = [];

  if (cat === "Trial") {
    parts.push(`แพ็กเกจทดลอง ${r.aiBaseDateE || 14} วัน`);
    parts.push("ใช้งาน AI Chat จำกัดโควต้า");
    if (bj) parts.push(`โควต้าประมาณ ${bj} ข้อความ`);
    parts.push("ไม่คิดราคาขาย (Best Price = 0)");
    return parts.join(" · ");
  }
  if (cat === "AI Base") {
    parts.push(`แพ็กเกจ AI Base ระดับ ${r.package || "—"}`);
    if (months === 1) parts.push("สัญญาราย 1 เดือน");
    else if (months === 6) parts.push("สัญญา 6 เดือน (ส่วนลด R=5%)");
    else if (months === 12) parts.push("สัญญา 12 เดือน (ส่วนลด R=10%)");
    if (bj) parts.push(`โควต้า ${Number(bj).toLocaleString()} ข้อความ/เดือน`);
    parts.push("รวม token ย้อนหลัง, คำนวณต้นทุน AI+Cloud+Token");
    return parts.join(" · ");
  }
  if (cat === "Storage Add-on") {
    parts.push(`Add-on ขยายพื้นที่เก็บข้อความ — ${r.package || "—"}`);
    if (months) parts.push(`รอบบิล ${months} เดือน`);
    if (bj) parts.push(`รองรับ ~${Number(bj).toLocaleString()} ข้อความ`);
    parts.push("คิดต้นทุน storage BB=BP×BN");
    return parts.join(" · ");
  }
  if (cat === "Expired Add-on") {
    parts.push(`Add-on เก็บประวัติหลังหมดอายุ — ${r.package || "—"}`);
    if (days) parts.push(`ระยะเก็บ ${days} วัน (คอลัมน์ D)`);
    parts.push("คิด retention BC=BM×AQ และ storage BB");
    return parts.join(" · ");
  }
  return `${r.plan} ${r.package}`.trim();
}

function defaultShareKb(r, ae, af) {
  if (af) return false;
  if (r.aiBaseMonthsF === 1 && !ae) return true;
  if (ae) return true;
  return false;
}

const packageRows = analysis.dataRows.map((r) => {
  const ae = cellVal(r.row, "AE");
  const af = cellVal(r.row, "AF");
  return {
    ...r,
    aeChecked: ynToBool(ae),
    afChecked: ynToBool(af),
    ac: cellVal(r.row, "AC") ?? "",
    ad: cellVal(r.row, "AD") ?? "",
    description: buildPackageDescription(r),
    shareKbDefault: defaultShareKb(r, ynToBool(ae), ynToBool(af)),
  };
});

/** Excel column → development field mapping (canonical) */
const COLUMN_FIELD_MAP = {
  A: {
    field: "plan",
    path: "inputs.plan",
    type: "string",
    ui: "text / select",
    editable: true,
    kb: true,
  },
  B: {
    field: "packageName",
    path: "inputs.packageName",
    type: "string",
    ui: "text",
    editable: true,
    kb: true,
  },
  C: {
    field: "baseAddon",
    path: "inputs.baseAddon",
    type: '"Base" | "Add-on"',
    ui: "select",
    editable: true,
    kb: true,
  },
  D: {
    field: "storageExpireDays",
    path: "inputs.storageExpireDays",
    type: "number",
    ui: "number",
    editable: true,
    kb: true,
  },
  E: {
    field: "trialDurationDays",
    path: "inputs.trialDurationDays",
    type: "number",
    ui: "number",
    editable: true,
    kb: true,
    note: "Excel only — ยังไม่มีใน CostPriceInputs (ใช้ aiBaseDateE จาก seed)",
  },
  F: {
    field: "aiBaseMonths",
    path: "inputs.aiBaseMonths",
    type: "number",
    ui: "number (0/1/6/12)",
    editable: true,
    kb: true,
  },
  G: {
    field: "zudobotBenefitMultiplier",
    path: "inputs.zudobotBenefitMultiplier",
    type: "number",
    ui: "number",
    editable: true,
    kb: false,
  },
  H: {
    field: "partnerBenefitDisplayPct",
    path: "— (display only)",
    type: "number",
    ui: "read-only / omit",
    editable: false,
    kb: false,
    note: "Formula (4500%)/100=0.45 — ไม่ feed chain หลัก",
  },
  I: {
    field: "zudobotBenefitThb",
    path: "calculated.zudobotBenefitThb",
    type: "number",
    ui: "read-only",
    editable: false,
    kb: false,
  },
  J: {
    field: "partnerBenefitThb",
    path: "calculated.partnerBenefitThb",
    type: "number",
    ui: "read-only",
    editable: false,
    kb: false,
  },
  K: {
    field: "partnerSharePct",
    path: "inputs.partnerSharePct",
    type: "number",
    ui: "number (0.35)",
    editable: true,
    kb: false,
  },
  L: {
    field: "zudobotBenefitPctAfterPartner",
    path: "calculated.zudobotBenefitPctAfterPartner",
    type: "number",
    ui: "read-only",
    editable: false,
    kb: false,
  },
  M: {
    field: "zudobotBenefitAfterPartnerThb",
    path: "calculated.zudobotBenefitAfterPartnerThb",
    type: "number",
    ui: "read-only",
    editable: false,
    kb: false,
  },
  N: {
    field: "priceMonthZudobot",
    path: "calculated.priceMonthZudobot",
    type: "number",
    ui: "read-only",
    editable: false,
    kb: false,
  },
  O: {
    field: "priceMonthPartner",
    path: "calculated.priceMonthPartner",
    type: "number",
    ui: "read-only",
    editable: false,
    kb: false,
  },
  P: {
    field: "priceZudobotInclWhtBeforeVat",
    path: "calculated.priceZudobotInclWhtBeforeVat",
    type: "number",
    ui: "read-only",
    editable: false,
    kb: false,
  },
  Q: {
    field: "pricePartnerInclWhtBeforeVat",
    path: "calculated.pricePartnerInclWhtBeforeVat",
    type: "number",
    ui: "read-only",
    editable: false,
    kb: false,
  },
  R: {
    field: "discountPct",
    path: "inputs.discountPct",
    type: "number",
    ui: "number",
    editable: true,
    kb: false,
  },
  S: {
    field: "zudoguDiscountThb",
    path: "calculated.zudoguDiscountThb",
    type: "number",
    ui: "read-only",
    editable: false,
    kb: false,
  },
  T: {
    field: "partnerDiscountThb",
    path: "calculated.partnerDiscountThb",
    type: "number",
    ui: "read-only",
    editable: false,
    kb: false,
  },
  U: {
    field: "afterDiscountZudobot",
    path: "calculated.afterDiscountZudobot",
    type: "number",
    ui: "read-only",
    editable: false,
    kb: false,
  },
  V: {
    field: "afterDiscountPartner",
    path: "calculated.afterDiscountPartner",
    type: "number",
    ui: "read-only",
    editable: false,
    kb: false,
  },
  W: {
    field: "vat7Zudobot",
    path: "calculated.vat7Zudobot",
    type: "number",
    ui: "read-only",
    editable: false,
    kb: false,
  },
  X: {
    field: "vat7Partner",
    path: "calculated.vat7Partner",
    type: "number",
    ui: "read-only",
    editable: false,
    kb: false,
  },
  Y: {
    field: "wht3Zudobot",
    path: "calculated.wht3Zudobot",
    type: "number",
    ui: "read-only",
    editable: false,
    kb: false,
  },
  Z: {
    field: "wht3Partner",
    path: "calculated.wht3Partner",
    type: "number",
    ui: "read-only",
    editable: false,
    kb: false,
  },
  AA: {
    field: "priceAfterVatZudobot",
    path: "calculated.priceAfterVatZudobot",
    type: "number",
    ui: "read-only",
    editable: false,
    kb: false,
  },
  AB: {
    field: "priceAfterVatPartner",
    path: "calculated.priceAfterVatPartner",
    type: "number",
    ui: "read-only",
    editable: false,
    kb: false,
  },
  AC: {
    field: "bestPriceZudobot",
    path: "inputs.bestPriceZudobot",
    type: "number",
    ui: "number (THB)",
    editable: true,
    kb: true,
  },
  AD: {
    field: "bestPricePartner",
    path: "inputs.bestPricePartner",
    type: "number",
    ui: "number (THB)",
    editable: true,
    kb: true,
  },
  AE: {
    field: "isBestPriceHighlight",
    path: "isBestPriceHighlight",
    type: "boolean",
    ui: "checkbox (checked=Yes/Y)",
    editable: true,
    kb: true,
    note: "Excel Y/N → Admin checkbox",
  },
  AF: {
    field: "isTrialPackage",
    path: "isTrialPackage",
    type: "boolean",
    ui: "checkbox (checked=Yes/Y)",
    editable: true,
    kb: true,
    note: "Excel Y/N → Admin checkbox",
  },
  AG: {
    field: "estimatePartnerBenefitThb",
    path: "calculated.estimatePartnerBenefitThb",
    type: "number",
    ui: "read-only",
    editable: false,
    kb: false,
  },
  AH: {
    field: "estimatePartnerBenefitPct",
    path: "calculated.estimatePartnerBenefitPct",
    type: "number",
    ui: "read-only",
    editable: false,
    kb: false,
  },
  AI: {
    field: "unitCostAiCore",
    path: "inputs.unitCostAiCore",
    type: "number",
    ui: "number",
    editable: true,
    kb: false,
  },
  AJ: {
    field: "unitCostDatabase",
    path: "inputs.unitCostDatabase",
    type: "number",
    ui: "number",
    editable: true,
    kb: false,
  },
  AK: {
    field: "unitCostAws",
    path: "inputs.unitCostAws",
    type: "number",
    ui: "number",
    editable: true,
    kb: false,
  },
  AL: {
    field: "unitCostS3",
    path: "inputs.unitCostS3",
    type: "number",
    ui: "number",
    editable: true,
    kb: false,
  },
  AM: {
    field: "unitCostVatIntl",
    path: "inputs.unitCostVatIntl",
    type: "number",
    ui: "number",
    editable: true,
    kb: false,
  },
  AN: {
    field: "unitCostFxRisk",
    path: "inputs.unitCostFxRisk",
    type: "number",
    ui: "number",
    editable: true,
    kb: false,
  },
  AO: {
    field: "unitCostPaymentGateway",
    path: "inputs.unitCostPaymentGateway",
    type: "number",
    ui: "number",
    editable: true,
    kb: false,
  },
  AP: {
    field: "costPerToken",
    path: "inputs.costPerToken",
    type: "number",
    ui: "number",
    editable: true,
    kb: false,
  },
  AQ: {
    field: "costPerMb",
    path: "inputs.costPerMb",
    type: "number",
    ui: "number",
    editable: true,
    kb: false,
  },
  AR: {
    field: "totalCostAr",
    path: "calculated.totalCostAr",
    type: "number",
    ui: "read-only",
    editable: false,
    kb: false,
    note: "alias monthlyTotalCost; ref mode → referenceUnitCostAq × F",
  },
  AS: {
    field: "totalCostRaw",
    path: "calculated.totalCostRaw",
    type: "number",
    ui: "read-only",
    editable: false,
    kb: false,
  },
  AT: {
    field: "costAiCore",
    path: "calculated.costAiCore",
    type: "number",
    ui: "read-only",
    editable: false,
    kb: false,
  },
  AU: {
    field: "costMongoDb",
    path: "calculated.costMongoDb",
    type: "number",
    ui: "read-only",
    editable: false,
    kb: false,
  },
  AV: {
    field: "costAws",
    path: "calculated.costAws",
    type: "number",
    ui: "read-only",
    editable: false,
    kb: false,
  },
  AW: {
    field: "costS3",
    path: "calculated.costS3",
    type: "number",
    ui: "read-only",
    editable: false,
    kb: false,
  },
  AX: {
    field: "costVatIntl",
    path: "calculated.costVatIntl",
    type: "number",
    ui: "read-only",
    editable: false,
    kb: false,
  },
  AY: {
    field: "costFxRisk",
    path: "calculated.costFxRisk",
    type: "number",
    ui: "read-only",
    editable: false,
    kb: false,
  },
  AZ: {
    field: "costPaymentGateway",
    path: "calculated.costPaymentGateway",
    type: "number",
    ui: "read-only",
    editable: false,
    kb: false,
  },
  BA: {
    field: "costTokenUsage",
    path: "calculated.costTokenUsage",
    type: "number",
    ui: "read-only",
    editable: false,
    kb: false,
  },
  BB: {
    field: "costStorageUsage",
    path: "calculated.costStorageUsage",
    type: "number",
    ui: "read-only",
    editable: false,
    kb: false,
  },
  BC: {
    field: "costRetentionStorage",
    path: "calculated.costRetentionStorage",
    type: "number",
    ui: "read-only",
    editable: false,
    kb: false,
  },
  BD: {
    field: "costPlaceholderBd",
    path: "—",
    type: "number",
    ui: "omit",
    editable: false,
    kb: false,
    note: "Placeholder ใน SUM(AT:BD) — มักว่าง",
  },
  BE: {
    field: "totalTokenUsageMonth",
    path: "calculated.totalTokenUsageMonth",
    type: "number",
    ui: "read-only",
    editable: false,
    kb: false,
  },
  BF: {
    field: "tokenUsageMonth",
    path: "calculated.tokenUsageMonth",
    type: "number",
    ui: "read-only",
    editable: false,
    kb: false,
  },
  BG: {
    field: "historyTokenCount",
    path: "inputs.historyTokenCount",
    type: "number",
    ui: "number",
    editable: true,
    kb: false,
  },
  BH: {
    field: "tokenDivisor",
    path: "inputs.tokenDivisor",
    type: "number",
    ui: "number",
    editable: true,
    kb: false,
  },
  BI: {
    field: "tokensPerMessage",
    path: "inputs.tokensPerMessage",
    type: "number",
    ui: "number",
    editable: true,
    kb: false,
  },
  BJ: {
    field: "messageCount",
    path: "inputs.messageCount",
    type: "number",
    ui: "number",
    editable: true,
    kb: true,
  },
  BK: {
    field: "storedTokensEffective",
    path: "calculated.storedTokensEffective",
    type: "number",
    ui: "read-only",
    editable: false,
    kb: false,
    note: "input override: inputs.storedTokens",
  },
  BL: {
    field: "chatsPerDayEstimate",
    path: "inputs.chatsPerDayEstimate",
    type: "number",
    ui: "number",
    editable: true,
    kb: false,
  },
  BM: {
    field: "retentionStorageMb",
    path: "calculated.retentionStorageMb",
    type: "number",
    ui: "read-only",
    editable: false,
    kb: false,
  },
  BN: {
    field: "storageCostPerMb",
    path: "inputs.storageCostPerMb",
    type: "number",
    ui: "number",
    editable: true,
    kb: false,
  },
  BO: {
    field: "storageMbPerSentence",
    path: "inputs.storageMbPerSentence",
    type: "number",
    ui: "number",
    editable: true,
    kb: false,
  },
  BP: {
    field: "storageUsageMb",
    path: "calculated.storageUsageMb",
    type: "number",
    ui: "read-only",
    editable: false,
    kb: false,
  },
};

const ADMIN_ONLY_FIELDS = [
  {
    field: "packageDescription",
    path: "packageDescription",
    type: "string",
    ui: "textarea",
    kb: true,
    note: "ไม่มีใน Excel — extension v1.2.0",
  },
  {
    field: "shareToKnowledgeBase",
    path: "shareToKnowledgeBase",
    type: "boolean",
    ui: "checkbox",
    kb: "controls sync",
    note: "ไม่มีใน Excel — extension v1.2.0",
  },
  {
    field: "label",
    path: "label",
    type: "string",
    ui: "text",
    kb: false,
    note: "ชื่อแสดงใน Admin list",
  },
  {
    field: "pricingMode",
    path: "inputs.pricingMode",
    type: '"unit_calc" | "reference_multiple"',
    ui: "hidden / auto",
    kb: false,
    note: "เมื่อ AR = $AR$base×F",
  },
  {
    field: "referenceUnitCostAq",
    path: "inputs.referenceUnitCostAq",
    type: "number",
    ui: "hidden / link",
    kb: false,
    note: "อ้างอิงแถวฐาน",
  },
  {
    field: "referenceScenarioId",
    path: "referenceScenarioId",
    type: "ObjectId",
    ui: "hidden / link",
    kb: false,
    note: "MongoDB FK ไปแถวฐาน",
  },
  {
    field: "unitCostAnchorMessageCount",
    path: "inputs.unitCostAnchorMessageCount",
    type: "number",
    ui: "global config (200)",
    kb: false,
    note: "Excel $BJ$3 anchor",
  },
  {
    field: "includeRetentionStorageCost",
    path: "inputs.includeRetentionStorageCost",
    type: "boolean",
    ui: "toggle",
    kb: false,
    note: "เปิด BC = BM×AQ",
  },
  {
    field: "sortOrder",
    path: "sortOrder",
    type: "number",
    ui: "number",
    kb: false,
  },
  {
    field: "isActive",
    path: "isActive",
    type: "boolean",
    ui: "toggle",
    kb: false,
  },
];

const COLUMN_PURPOSE = {
  A: "ระบุกลุ่มแผน (Plan) เช่น Trial, AI Base, Storage Add-on, Expired Add-on",
  B: "ชื่อแพ็กเกจย่อย (Starter, Pro, Storage begin, Expired Pro ฯลฯ)",
  C: "ประเภท Base (แพ็กหลัก) หรือ Add-on (เสริม)",
  D: "จำนวนวัน Storage Expire — ใช้กับ Expired Add-on (BK, BM, BC)",
  E: "ช่วงทดลอง AI BASE (วัน) — Trial/Storage Trial ใช้ 14",
  F: "ตัวคูณรอบบิล (เดือน): 0=Trial, 1=รายเดือน, 6/12=แพ็กระยะยาว",
  G: "ตัวคูณ zudobot benefit — คูณ AR เพื่อได้ I (default 6 = 600% ของต้นทุน)",
  H: "partner %benefit แสดงผล — สูตร `(4500%)/100` = 0.45 (ไม่ใช้ใน chain หลัก; chain ใช้ K)",
  I: "zudobot benefit เป็น THB = G × AR",
  J: "Partner benefit THB = I − (I × K)",
  K: "Partner % benefit (0.35 = 35%) — ใช้ใน O, J",
  L: "สัดส่วน zudobot benefit หลังหัก partner = O/N",
  M: "zudobot benefit หลัง partner THB = N − O",
  N: "ราคา/เดือน Zudobot = I + AR (ต้นทุน + benefit)",
  O: "ราคา/เดือน Partner = N − (N × K)",
  P: "ราคา Zudobot รวม WHT 3% ก่อน VAT = N + Y",
  Q: "ราคา Partner รวม WHT 3% ก่อน VAT = O + Z",
  R: "อัตราส่วนลด (0, 0.05, 0.1) คูณกับ P/Q",
  S: "ส่วนลด Zudobot THB = P × R",
  T: "ส่วนลด Partner THB = Q × R",
  U: "ราคาหลังส่วนลด Zudobot = P − S",
  V: "ราคาหลังส่วนลด Partner = Q − T",
  W: "VAT 7% Zudobot — AI Base F∈{1,6,12} Starter แถว 4–6: U×7%; ที่เหลือ: N×7%",
  X: "VAT 7% Partner — คู่กับ W (ใช้ V หรือ O ตาม pattern เดียวกัน)",
  Y: "WHT 3% บน N (Zudobot) = N × 3%",
  Z: "WHT 3% บน O (Partner) = O × 3%",
  AA: "ราคาขายหลัง VAT Zudobot = P + W",
  AB: "ราคาขายหลัง VAT Partner = Q + X",
  AC: "Best Price / FINAL ราคา Zudobot — **กรอกมือ** (Marketing, THB)",
  AD: "Best Price / FINAL ราคา Partner — **กรอกมือ** (THB)",
  AE: "Best Price highlight flag — **Admin Checkbox** (Excel Y/N: checked=Yes)",
  AF: "Trial package flag — **Admin Checkbox** (Excel Y/N: checked=Yes)",
  AG: "Estimate Partner Benefit THB = AC − AD",
  AH: "Estimate Partner % = (AG × 100) / AC",
  AI: "Unit cost AI Core (Gemini) ต่อข้อความ — input",
  AJ: "Unit cost MongoDB Atlas ต่อข้อความ",
  AK: "Unit cost AWS (Compute/Amplify) ต่อข้อความ",
  AL: "Unit cost Amazon S3 ต่อข้อความ",
  AM: "Unit cost VAT 7% ฝั่งจ่าย (บริการต่างประเทศ)",
  AN: "Unit cost FX Risk 2.5%",
  AO: "Unit cost Payment Gateway 3.4%",
  AP: "ต้นทุนต่อ 1 token (THB)",
  AQ: "ต้นทุนพื้นที่จัดเก็บต่อ 1 MB — ใช้ใน BC = BM × AQ",
  AR: "**ต้นทุนรวมปัดขึ้น (ROUNDUP)** — ใช้ในราคา I, N; หรือ =$AR$base×F",
  AS: "ผลรวมต้นทุนดิบ = SUM(AT:BD)",
  AT: "ต้นทุน AI Core ต่อเดือน = AI × $BJ$3 (anchor) หรือค่าคงที่",
  AU: "ต้นทุน MongoDB = AJ × $BJ$3",
  AV: "ต้นทุน AWS = AK × $BJ$3",
  AW: "ต้นทุน S3 = AL × $BJ$3",
  AX: "ต้นทุน VAT ตปท. = AM × $BJ$3",
  AY: "ต้นทุน FX = AN × $BJ$3",
  AZ: "ต้นทุน Payment GW = AO × $BJ$3",
  BA: "ต้นทุน token usage = BE × AP (AI Base / Trial เท่านั้น)",
  BB: "ต้นทุน storage ใช้งาน = BP × BN",
  BC: "ต้นทุน retention = BM × AQ (Expired)",
  BD: "สำรองใน SUM(AT:BD) — มักว่าง",
  BE: "Total token usage / เดือน = BF + BG",
  BF: "Token usage เดือน = BI × BJ",
  BG: "Token ข้อความย้อนหลัง (history pool)",
  BH: "ตัวหาร token (มัก = 1)",
  BI: "Token ต่อ 1 ข้อความ (default 2500); แถว 3 = BI4/BJ4",
  BJ: "จำนวนข้อความ / quota — **anchor $BJ$3=200 (Trial row 3)**",
  BK: "Token จัดเก็บตาม Expiry = (BI × BL) × D",
  BL: "จำนวนคนคุยต่อวัน (ประมาณการ)",
  BM: "MB จัดเก็บตาม Expiry = (BK / BI) × 7",
  BN: "ต้นทุน storage ต่อ MB",
  BO: "MB ต่อประโยค (default 8)",
  BP: "MB storage ใช้งานจริง = BO × BJ",
};

const COLUMN_SOURCE = {
  A: "Manual — Product catalog",
  B: "Manual — Product catalog",
  C: "Manual — enum Base|Add-on",
  D: "Manual — Expired tier days",
  E: "Manual — Trial duration (days)",
  F: "Manual — Billing months",
  G: "Manual — Pricing policy (default 6)",
  H: "Formula (display) — ไม่ feed chain หลัก",
  I: "Formula ← G, AR",
  J: "Formula ← I, K",
  K: "Manual — Partner contract (0.35)",
  L: "Formula ← O, N",
  M: "Formula ← N, O",
  N: "Formula ← I, AR",
  O: "Formula ← N, K",
  P: "Formula ← N, Y",
  Q: "Formula ← O, Z",
  R: "Manual — Promotion",
  S: "Formula ← P, R",
  T: "Formula ← Q, R",
  U: "Formula ← P, S",
  V: "Formula ← Q, T",
  W: "Formula ← U หรือ N × 7%",
  X: "Formula ← V หรือ O × 7%",
  Y: "Formula ← N × 3%",
  Z: "Formula ← O × 3%",
  AA: "Formula ← P, W",
  AB: "Formula ← Q, X",
  AC: "Manual — Marketing final price (THB)",
  AD: "Manual — Partner final price (THB)",
  AE: "Manual — **Checkbox** (checked=Yes/Y, unchecked=No/N)",
  AF: "Manual — **Checkbox** (checked=Yes/Y, unchecked=No/N)",
  AG: "Formula ← AC, AD",
  AH: "Formula ← AG, AC",
  AI: "Manual — Finance benchmark",
  AJ: "Manual — Finance benchmark",
  AK: "Manual — Finance benchmark",
  AL: "Manual — Finance benchmark",
  AM: "Manual — Finance benchmark",
  AN: "Manual — Finance benchmark",
  AO: "Manual — Finance benchmark",
  AP: "Manual — Token pricing",
  AQ: "Manual — Storage MB pricing",
  AR: "Formula ← ROUNDUP(AS) หรือ $AR$ref×F",
  AS: "Formula ← SUM(AT:BD)",
  AT: "Formula ← AI×$BJ$3 หรือ Manual",
  AU: "Formula ← AJ×$BJ$3 หรือ Manual",
  AV: "Formula ← AK×$BJ$3 หรือ Manual",
  AW: "Formula ← AL×$BJ$3 หรือ Manual",
  AX: "Formula ← AM×$BJ$3 หรือ Manual",
  AY: "Formula ← AN×$BJ$3 หรือ Manual",
  AZ: "Formula ← AO×$BJ$3 หรือ Manual",
  BA: "Formula ← BE×AP",
  BB: "Formula ← BP×BN",
  BC: "Formula ← BM×AQ",
  BD: "— (placeholder in SUM range)",
  BE: "Formula ← BF+BG",
  BF: "Formula ← BI×BJ",
  BG: "Manual — History token pool",
  BH: "Manual — Divisor (1)",
  BI: "Manual / Formula BI4/BJ4 on row 3",
  BJ: "Manual — Message quota",
  BK: "Formula ← (BI×BL)×D",
  BL: "Manual — Chats/day estimate",
  BM: "Formula ← (BK/BI)×7 หรือ ×D บางแถว",
  BN: "Manual — Storage unit cost",
  BO: "Manual — MB per sentence",
  BP: "Formula ← BO×BJ",
};

const sourceName = path.basename(xlsxPath);
let md = `# ZUDOBOT — FUNCTION TECHNICAL SPECIFICATION
## Cost & Price Calculator (Spreadsheet Parity + Admin Metadata)

**Document ID:** ${DOC_ID}  
**Version:** ${VERSION}  
**Date:** 2026-05-29  
**Status:** Active  
**Source artifact:** \`${sourceName}\`  
**Sheet name:** \`${analysis.sheetName}\`  
**Dimensions:** ${analysis.dimensions.rows} แถว × ${analysis.dimensions.cols} คอลัมน์ (${analysis.dimensions.range})  
**Formula cells:** ${analysis.stats.totalFormulaCells}  
**Package data rows:** ${analysis.stats.totalDataRows}  
**Runtime function:** \`fnc_cal_zdb_cost_price()\` in \`apps/web/lib/pricing/costPriceCalculator.ts\`  
**MongoDB model:** \`CostPriceScenario\` in \`apps/web/lib/db/models/CostPriceScenario.ts\`

---

## 1) Document History

| Version | Date | Author | Summary |
|---------|------|--------|---------|
| 1.0.0 | 2026-05-29 | Luesat / AI-assisted | วิเคราะห์ 68 คอลัมน์ + 1,250 สูตร จาก ODS/XLSX |
| 1.1.0 | 2026-05-29 | Luesat / AI-assisted | เพิ่ม packageDescription, shareToKnowledgeBase, Checkbox spec AE/AF (Word) |
| **1.2.0** | **2026-05-29** | **Luesat / AI-assisted** | **Markdown FTS ครบถ้วน + Column→Field mapping สำหรับพัฒนา Admin/KB** |

---

## 2) Business Purpose

Spreadsheet \`${sourceName}\` เป็น **Single Source of Truth** สำหรับ:

1. **Unit economics** — แยกต้นทุน AI, DB, Cloud, Tax, Token, Storage, Retention
2. **Pricing model** — Benefit multiplier (G), Partner share (K), Discount (R)
3. **Tax compliance display** — WHT 3%, VAT 7% (สูตรใน sheet ใช้เพื่อแสดงราคา ไม่ใช่ใบกำกับภาษี)
4. **Go-to-market** — Best Price (AC/AD) vs calculated price (AA/AB)
5. **Multi-month packaging** — อ้างอิงต้นทุนฐาน AR × F
6. **Admin extension (v1.2.0)** — คำอธิบายแพ็กเกจ, แชร์ KB, Checkbox แทน Y/N

---

## 3) Calculation Flow

\`\`\`mermaid
flowchart TB
  subgraph INPUT["Manual Inputs"]
    ID[A–F Identity]
    POL[G,K,R AC/AD]
    FLAGS[AE/AF Checkbox]
    UNIT[AI–AQ Unit costs]
    USE[BJ,BI,BG,BO,BN,D,BL]
  end

  subgraph COST["Cost Rollup"]
    ATAZ["AT:AZ = Unit × \$BJ\$3"]
    BA["BA = BE × AP"]
    BB["BB = BP × BN"]
    BC["BC = BM × AQ"]
    AS["AS = SUM(AT:BD)"]
    AR["AR = ROUNDUP(AS) or \$AR\$base×F"]
  end

  subgraph PRICE["Price Chain"]
    I["I = G × AR"]
    N["N = I + AR"]
    O["O = N − N×K"]
    P["P = N + N×3%"]
    SR["S,T,U,V discount"]
    WV["W,X VAT 7%"]
    AA["AA = P + W"]
  end

  subgraph META["Admin Metadata"]
    DESC[packageDescription]
    KB[shareToKnowledgeBase]
  end

  INPUT --> COST --> PRICE
  POL --> PRICE
  FLAGS --> META
  PRICE --> META
\`\`\`

---

## 4) Package Catalog + Metadata

### 4.1 รายการแพ็กเกจจาก Excel

| Row | Plan (A) | Package (B) | Type (C) | D | E | F | AC | AD | AE ☑ | AF ☑ | KB แนะนำ |
|-----|----------|-------------|----------|---|---|---|----|----|------|------|----------|
`;

for (const r of packageRows) {
  md += `| ${r.row} | ${esc(r.plan)} | ${esc(r.package)} | ${esc(r.baseAddon)} | ${r.storageExpireDays ?? "—"} | ${r.aiBaseDateE ?? "—"} | ${r.aiBaseMonthsF ?? "—"} | ${r.ac} | ${r.ad} | ${r.aeChecked ? "Yes" : "No"} | ${r.afChecked ? "Yes" : "No"} | ${r.shareKbDefault ? "✓" : "—"} |\n`;
}

md += `
### 4.2 คำอธิบายแพ็กเกจ (\`packageDescription\`) — ช่องใหม่ใน Admin

Admin สามารถแก้ไขคำอธิบายรายละเอียดต่อแพ็กเกจ (ไม่มีใน Excel — extension ของ FTS v1.2.0)

| Row | Plan / Package | คำอธิบายเริ่มต้น (editable textarea) |
|-----|----------------|-------------------------------------|
`;

for (const r of packageRows) {
  md += `| ${r.row} | ${esc(r.package || r.plan)} | ${esc(r.description)} |\n`;
}

md += `
### 4.3 Knowledge Base Sharing (\`shareToKnowledgeBase\`)

**Checkbox ใน Admin** — checked = แชร์เข้า Zudobot Knowledge Base

| เมื่อ checked (✓) | ข้อมูลที่ sync ไป KB |
|-------------------|----------------------|
| ✓ | \`plan\`, \`packageName\`, \`packageDescription\`, \`baseAddon\` |
| ✓ | \`bestPriceZudobot\`, \`bestPricePartner\` (AC/AD) ถ้ามีค่า > 0 |
| ✓ | \`aiBaseMonths\` (F), \`storageExpireDays\` (D) ถ้ามี |
| ✓ | \`messageCount\` (BJ) โควต้าที่แสดงลูกค้า |
| ✓ | \`isBestPriceHighlight\`, \`isTrialPackage\` (boolean จาก checkbox) |
| ✗ ห้าม sync | ต้นทุนภายใน AI–AR, unit costs, margin G/K, สูตรดิบ, calculated.* |

### 4.4 หมวดหมู่แพ็กเกจ

| หมวด | แถว | สิ่งที่ลูกค้าได้ | AF (Trial ☑) |
|------|-----|------------------|--------------|
| **Trial** | 3, 16, 29 | ทดลองใช้ 14 วัน | Yes |
| **AI Base** | 4–15 | AI Chat ตาม tier + รอบบิล 1/6/12 เดือน | No |
| **Storage Add-on** | 17–28 | พื้นที่เก็บข้อความเพิ่ม | No |
| **Expired Add-on** | 30–49 | เก็บประวัติหลังหมดอายุตาม D วัน | No |

### 4.5 แถวฐานต้นทุน (Base Unit Rows)

| แถว | Package | AR formula | แถวลูกอ้างอิง |
|-----|---------|------------|---------------|
| 4 | Starter | ROUNDUP(AS4) | 5–6 → $AR$4×F |
| 7 | Pro | ROUNDUP(AS7) | 8–9 → $AR$7×F |
| 10 | Super | ROUNDUP(AS10) | 11–12 → $AR$10×F |
| 13 | MAX | ROUNDUP(AS13) | 14–15 → $AR$13×F |
| 17 | Storage begin | ROUNDUP(AS17) | 18–19 → $AR$17×F |
| 20 | Storage Pro | ROUNDUP(AS20) | 21–22 → $AR$20×F |
| 23 | Storage Super | ROUNDUP(AS23) | 24–25 → $AR$23×F |
| 26 | Storage Max | ROUNDUP(AS26) | 27–28 → $AR$26×F |
| 29–49 | Expired * | ROUNDUP(AS) แต่ละแถว | ไม่ใช้ ×F |

---

## 5) Admin UI — Checkbox & Field Specification

ค่า **Yes/No ใน Excel (Y/N) ต้อง map เป็น Checkbox** ใน Admin UI:

| Checked | Unchecked | Excel แสดง |
|---------|-----------|------------|
| \`true\` | \`false\` | Y / N |
| Yes | No | Y / N |

### 5.1 ตาราง UI Controls

| Excel Col | Header (แถว 2) | Dev Field | MongoDB Path | UI Control | Checked | Unchecked |
|-----------|----------------|-----------|--------------|------------|---------|-----------|
| AE | Best Price flag | \`isBestPriceHighlight\` | \`isBestPriceHighlight\` | **Checkbox** | Yes (Y) | No (N) |
| AF | Trial flag | \`isTrialPackage\` | \`isTrialPackage\` | **Checkbox** | Yes (Y) | No (N) |
| — | — | \`shareToKnowledgeBase\` | \`shareToKnowledgeBase\` | **Checkbox** | sync KB | ไม่ sync |
| AC | FINAL Price Zudobot | \`bestPriceZudobot\` | \`inputs.bestPriceZudobot\` | Number (THB) | — | — |
| AD | FINAL Price Partner | \`bestPricePartner\` | \`inputs.bestPricePartner\` | Number (THB) | — | — |
| — | — | \`packageDescription\` | \`packageDescription\` | **Textarea** | — | — |

### 5.2 กฎ Best Price (AC/AD/AE)

- **AC/AD** = ช่องตัวเลขราคาขายสุดท้าย (FINAL Price THB) — กรอกมือเมื่อกำหนดราคาขาย
- **AE** = checkbox บอกว่าแถวนี้เป็นแถวอ้างอิง Best Price ของ tier
- **AG/AH** คำนวณจาก AC−AD อัตโนมัติ — ไม่ใช้ checkbox
- **Trial (AF=Yes):** AC/AD มักเป็น 0

### 5.3 ค่า AE/AF ในไฟล์ XLSX ปัจจุบัน

| Column | Checkbox = Yes (Y) ที่แถว | ความหมาย |
|--------|---------------------------|----------|
| **AF** | 3, 16, 29 | Trial package |
| **AE** | 10, 20, 35 | Best Price highlight (Super 1mo, Storage Pro 1mo, Expired Pro 7d) |

### 5.4 Import/Export mapping Y/N ↔ boolean

\`\`\`typescript
// Excel → MongoDB
isBestPriceHighlight: cellAE === "Y"
isTrialPackage: cellAF === "Y"

// MongoDB → Excel export
cellAE = isBestPriceHighlight ? "Y" : "N"
cellAF = isTrialPackage ? "Y" : "N"
\`\`\`

---

## 6) Column → Development Field Mapping (Master Table)

ตารางนี้ map **ทุกคอลัมน์ Excel (A–BP)** ไปยัง **field name สำหรับพัฒนา** ใน TypeScript / MongoDB / Admin UI

| Col | Header แถว 2 | Excel ที่มา | Dev Field | MongoDB Path | Type | UI | Editable | KB Sync |
|-----|---------------|-------------|-----------|--------------|------|-----|----------|---------|
`;

for (const col of COL_ORDER) {
  const h = analysis.headers[col];
  const m = COLUMN_FIELD_MAP[col] || {};
  const title = esc((h.row2 || col).split("\n")[0]);
  md += `| **${col}** | ${title} | ${COLUMN_SOURCE[col] ?? "—"} | \`${m.field ?? "—"}\` | \`${m.path ?? "—"}\` | ${m.type ?? "—"} | ${m.ui ?? "—"} | ${m.editable ? "✓" : "—"} | ${m.kb ? "✓" : "—"} |\n`;
}

md += `
### 6.1 Admin-only fields (ไม่มีใน Excel)

| Dev Field | MongoDB Path | Type | UI | KB | หมายเหตุ |
|-----------|--------------|------|-----|-----|----------|
`;

for (const f of ADMIN_ONLY_FIELDS) {
  md += `| \`${f.field}\` | \`${f.path}\` | ${f.type} | ${f.ui} | ${f.kb === true ? "✓" : f.kb === "controls sync" ? "control" : "—"} | ${f.note} |\n`;
}

md += `
### 6.2 โครงสร้าง MongoDB \`CostPriceScenario\` (target schema v1.2.0)

\`\`\`typescript
interface CostPriceScenario {
  label: string;                          // Admin list name
  packageDescription?: string;            // NEW — textarea
  shareToKnowledgeBase?: boolean;         // NEW — checkbox
  isBestPriceHighlight?: boolean;       // NEW — Excel AE checkbox
  isTrialPackage?: boolean;             // NEW — Excel AF checkbox
  inputs: CostPriceInputs;                // Manual + marketing fields
  calculated: CostPriceCalculated;        // fnc_cal_zdb_cost_price output
  referenceScenarioId?: ObjectId;         // Link to base row
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
\`\`\`

### 6.3 Mapping กลุ่มคอลัมน์ (สรุป)

| กลุ่ม Excel | คอลัมน์ | MongoDB |
|-------------|---------|---------|
| Identity | A, B, C, D, E, F | \`inputs.*\` |
| Pricing policy | G, K, R | \`inputs.*\` |
| Marketing | AC, AD, AE, AF | \`inputs.*\` + root flags |
| Price chain (calc) | I–AB | \`calculated.*\` |
| Partner estimate | AG, AH | \`calculated.*\` |
| Unit costs | AI–AQ | \`inputs.*\` |
| Cost rollup | AR–BD | \`calculated.*\` |
| Usage / storage | BE–BP | \`inputs.*\` + \`calculated.*\` |
| Admin meta | — | \`packageDescription\`, \`shareToKnowledgeBase\`, \`label\` |

---

## 7) Column Dictionary (A–BP) — ครบทุกคอลัมน์

วิเคราะห์จาก \`${sourceName}\` — header แถว 1–2 ทุกตัวอักษร, ที่มา, วัตถุประสงค์, สูตรทุกแบบ, ค่ามือ

`;

for (const col of COL_ORDER) {
  const h = analysis.headers[col];
  const a = analysis.colAnalysis[col];
  const m = COLUMN_FIELD_MAP[col] || {};
  const title = h.row2.split("\n")[0] || col;
  const groupHeader = h.row1 ? ` (${h.row1})` : "";

  md += `### ${col} — ${title}${groupHeader}

| คุณสมบัติ | รายละเอียด |
|-----------|------------|
| **Index** | ${h.colIndex} |
| **Header แถว 1** | ${esc(h.row1) || "—"} |
| **Header แถว 2** | ${esc(h.row2)} |
| **Dev Field** | \`${m.field ?? "—"}\` |
| **MongoDB Path** | \`${m.path ?? "—"}\` |
| **ที่มาข้อมูล** | ${COLUMN_SOURCE[col] ?? "—"} |
| **วัตถุประสงค์** | ${COLUMN_PURPOSE[col] ?? "—"} |
| **สูตรใน sheet** | ${a.formulaCells} เซลล์ |
| **ค่ามือ** | ${a.valueCells} เซลล์ |
| **ว่าง** | ${a.emptyCells} เซลล์ |
${m.note ? `| **หมายเหตุ mapping** | ${m.note} |` : ""}

**สูตรที่พบ:**

${formulaBlock(a.patterns)}${inputBlock(a.patterns)}

---

`;
}

md += `## 8) Formula Reference (Canonical Templates)

เมื่อแทน \`r\` = หมายเลขแถวปัจจุบัน, \`$BJ$3\` = anchor 200 จากแถว Trial

| Col | Template | Dev Field (output) | วัตถุประสงค์ |
|-----|----------|-------------------|--------------|
| H | \`(4500%)/100\` → 0.45 | — (display) | แสดง partner benefit % |
| I | \`Gr * ARr\` | \`zudobotBenefitThb\` | zudobot benefit THB |
| J | \`Ir - (Ir * Kr)\` | \`partnerBenefitThb\` | Partner benefit THB |
| L | \`((Or * 100) / Nr) / 100\` | \`zudobotBenefitPctAfterPartner\` | % benefit หลัง partner |
| M | \`Nr - Or\` | \`zudobotBenefitAfterPartnerThb\` | benefit THB หลัง partner |
| N | \`Ir + ARr\` | \`priceMonthZudobot\` | ราคา/เดือน Zudobot |
| O | \`Nr - (Nr * Kr)\` | \`priceMonthPartner\` | ราคา/เดือน Partner |
| P | \`Nr + Yr\` | \`priceZudobotInclWhtBeforeVat\` | ราคา + WHT ก่อน VAT |
| Q | \`Or + Zr\` | \`pricePartnerInclWhtBeforeVat\` | ราคา Partner + WHT |
| S | \`Pr * Rr\` | \`zudoguDiscountThb\` | ส่วนลด Zudobot |
| T | \`Qr * Rr\` | \`partnerDiscountThb\` | ส่วนลด Partner |
| U | \`Pr - Sr\` | \`afterDiscountZudobot\` | หลังส่วนลด Zudobot |
| V | \`Qr - Tr\` | \`afterDiscountPartner\` | หลังส่วนลด Partner |
| W | \`Ur * 7%\` (แถว 4–6) หรือ \`Nr * 7%\` | \`vat7Zudobot\` | VAT Zudobot |
| X | \`Vr * 7%\` หรือ \`Or * 7%\` | \`vat7Partner\` | VAT Partner |
| Y | \`Nr * 3%\` | \`wht3Zudobot\` | WHT Zudobot |
| Z | \`Or * 3%\` | \`wht3Partner\` | WHT Partner |
| AA | \`Pr + Wr\` | \`priceAfterVatZudobot\` | ราคาหลัง VAT Zudobot |
| AB | \`Qr + Xr\` | \`priceAfterVatPartner\` | ราคาหลัง VAT Partner |
| AG | \`ACr - ADr\` | \`estimatePartnerBenefitThb\` | กำไร Partner |
| AH | \`(AGr * 100) / ACr\` | \`estimatePartnerBenefitPct\` | % กำไร Partner |
| AR | \`ROUNDUP(ASr, 0)\` หรือ \`$AR$base * Fr\` | \`totalCostAr\` | ต้นทุนรวม |
| AS | \`SUM(ATr:BDr)\` | \`totalCostRaw\` | ผลรวมต้นทุน |
| AT | \`AIr * $BJ$3\` | \`costAiCore\` | ต้นทุน AI scaled |
| AU–AZ | \`AJr..AOrr * $BJ$3\` | \`costMongoDb\`…\`costPaymentGateway\` | ต้นทุนหมวดอื่น |
| BA | \`BEr * APr\` | \`costTokenUsage\` | Token cost |
| BB | \`BPr * BNr\` | \`costStorageUsage\` | Active storage |
| BC | \`BMr * AQr\` | \`costRetentionStorage\` | Retention |
| BE | \`BFr + BGr\` | \`totalTokenUsageMonth\` | Total tokens/month |
| BF | \`BIr * BJr\` | \`tokenUsageMonth\` | Monthly token |
| BI | \`BI4/BJ4\` (row 3 only) | \`tokensPerMessage\` | Derived tokens/msg Trial |
| BK | \`(BIr * BLr) * Dr\` | \`storedTokensEffective\` | Stored tokens |
| BM | \`(BKr/BIr) * 7\` | \`retentionStorageMb\` | Retention MB |
| BP | \`BOr * BJr\` | \`storageUsageMb\` | Storage MB |

---

## 9) Row Behavior Patterns

### 9.1 AI Base — แถวฐาน vs แถวอ้างอิง

| Pattern | แถว | AR | AT:AZ | BA | pricingMode |
|---------|-----|-----|-------|-----|-------------|
| Full calc | 4,7,10,13 | ROUNDUP(AS) | AI×$BJ$3 | BE×AP | \`unit_calc\` |
| Reference | 5,6,8,9,11,12,14,15 | $AR$base×F | _(ว่าง)_ | _(ว่าง)_ | \`reference_multiple\` |

### 9.2 Storage Add-on

- แถวฐาน 17,20,23,26 — คำนวณ BB, ไม่มี BA (AP=0)
- VAT: \`W = N×7%\` (ไม่ใช้ U×7%)

### 9.3 Expired Add-on

- ทุกแถวคำนวณ AR=ROUNDUP(AS) แยกตาม D (1,7,30,90,120,180)
- แถวแรกของ tier (D=7): AT = AI×$BJ$3; แถว D>7 บางรายการใช้ค่าคงที่ AT=160
- BC = BM×AQ, BK = (BI×BL)×D

### 9.4 VAT Exception (สำคัญ)

| เงื่อนไข | W (VAT Zudobot) | Dev field |
|----------|-----------------|-----------|
| AI Base Starter แถว 4,5,6 (F=1,6,12) | \`Ur * 7%\` | \`vat7Zudobot\` |
| แถวอื่นทั้งหมดที่มีสูตร W | \`Nr * 7%\` | \`vat7Zudobot\` |

---

## 10) Default Unit Costs (จากแถวฐาน)

| Excel Col | Dev Field | Default | คำอธิบาย |
|-----------|-----------|---------|----------|
| AI | \`unitCostAiCore\` | 0.16 | AI Core / message unit |
| AJ | \`unitCostDatabase\` | 0.06 | MongoDB |
| AK | \`unitCostAws\` | 0.05 | AWS |
| AL | \`unitCostS3\` | 0.01 | S3 |
| AM | \`unitCostVatIntl\` | 0.0196 | VAT intl |
| AN | \`unitCostFxRisk\` | 0.007 | FX 2.5% |
| AO | \`unitCostPaymentGateway\` | 0.04726 | Payment GW 3.4% |
| AP | \`costPerToken\` | 0.0000105 | per token |
| AQ | \`costPerMb\` | 0.01 | per MB retention |
| BJ anchor | \`unitCostAnchorMessageCount\` | **200** | Trial row 3 — $BJ$3 |
| BI | \`tokensPerMessage\` | 2500 | tokens per message |
| BG | \`historyTokenCount\` | 10000 | history tokens |
| BO | \`storageMbPerSentence\` | 8 | MB per sentence |
| BN | \`storageCostPerMb\` | 0.01 | storage cost/MB |
| G | \`zudobotBenefitMultiplier\` | 6 | benefit multiplier |
| K | \`partnerSharePct\` | 0.35 | partner share |

---

## 11) Mapping to \`fnc_cal_zdb_cost_price\`

| Spreadsheet | Dev Field | MongoDB Path |
|-------------|-----------|--------------|
| A, B, C | plan, packageName, baseAddon | inputs.* |
| D | storageExpireDays | inputs.storageExpireDays |
| F | aiBaseMonths | inputs.aiBaseMonths |
| G | zudobotBenefitMultiplier | inputs.zudobotBenefitMultiplier |
| K | partnerSharePct | inputs.partnerSharePct |
| R | discountPct | inputs.discountPct |
| AC, AD | bestPriceZudobot, bestPricePartner | inputs.* |
| AE | isBestPriceHighlight | root (checkbox) |
| AF | isTrialPackage | root (checkbox) |
| AI–AO | unitCost* | inputs.* |
| AP | costPerToken | inputs.costPerToken |
| AQ | costPerMb | inputs.costPerMb |
| BJ | messageCount | inputs.messageCount |
| BJ$3 anchor | unitCostAnchorMessageCount | inputs (200) |
| BG | historyTokenCount | inputs.historyTokenCount |
| BI | tokensPerMessage | inputs.tokensPerMessage |
| BO, BN | storageMbPerSentence, storageCostPerMb | inputs.* |
| BL, BK | chatsPerDayEstimate, storedTokens | inputs.* |
| AR ref × F | pricingMode=reference_multiple | inputs + referenceScenarioId |
| I–AB, AG–AH, AT–BC | calculated.* | calculated.* |

---

## 12) Known Spreadsheet Quirks

1. **คอลัมน์ H (0.45)** ไม่ถูกใช้ในสูตร I–AB — chain ใช้ **K=0.35**
2. **คอลัมน์ BD** อยู่ใน SUM(AT:BD) แต่มักว่าง
3. **Expired แถว D>7** บางแถวใช้ค่าคงที่ AT=160 แทนสูตร AI×$BJ$3
4. **แถว 3 Trial** AT:AZ เป็นค่าตัวเลขตรง ไม่ใช่สูตร (ยกเว้น BA, BE, BF)
5. **Label ซ้ำ** E และ F ทั้งคู่ header "AI BASE (Date)" — F คือเดือน, E คือวันทดลอง
6. **AE/AF ใน Excel เป็น Y/N** — Admin ต้องใช้ checkbox; import/export แปลง boolean ↔ Y/N

---

## 13) Security & Governance

- การคำนวณต้องทำ **ฝั่ง server** (\`fnc_cal_zdb_cost_price\`) — ห้ามเชื่อค่า calculated จาก client
- RBAC: อ่าน = admin+; เขียน/seed/import = super_admin
- KB sync: ส่งเฉพาะฟิลด์ที่ \`shareToKnowledgeBase=true\` และอยู่ใน allow-list (§4.3)
- แยก collection \`CostPriceScenario\` — **ไม่กระทบ** public pricing / Stripe checkout

---

## Appendix A — Base Row Reference Matrix

| Child row | Package | Formula | referenceScenarioId → base row |
|-----------|---------|---------|-------------------------------|
| 5–6 | Starter 6m/12m | $AR$4 × F | row 4 |
| 8–9 | Pro 6m/12m | $AR$7 × F | row 7 |
| 11–12 | Super 6m/12m | $AR$10 × F | row 10 |
| 14–15 | MAX 6m/12m | $AR$13 × F | row 13 |
| 18–19 | Storage begin | $AR$17 × F | row 17 |
| 21–22 | Storage Pro | $AR$20 × F | row 20 |
| 24–25 | Storage Super | $AR$23 × F | row 23 |
| 27–28 | Storage Max | $AR$26 × F | row 26 |

---

## Appendix B — Worked Example: Row 4 (Starter, 1 month)

| Excel | Dev Field | Value |
|-------|-----------|-------|
| BJ | messageCount | 1000 |
| AR | totalCostAr | 98 (ROUNDUP(97.127)) |
| I | zudobotBenefitThb | 588 (=6×98) |
| N | priceMonthZudobot | 686 (=588+98) |
| O | priceMonthPartner | 445.9 |
| AA | priceAfterVatZudobot | 756.04 |
| AC / AD | bestPriceZudobot / bestPricePartner | 799 / 399 |
| AG | estimatePartnerBenefitThb | 400 |
| AE / AF | isBestPriceHighlight / isTrialPackage | No / No |

---

## Appendix C — Unique Formula Templates

`;

const uniqueFormulas = new Map();
if (xws) {
  const xRange = XLSX.utils.decode_range(xws["!ref"]);
  for (let r = xRange.s.r; r <= xRange.e.r; r++) {
    for (let c = xRange.s.c; c <= xRange.e.c; c++) {
      let col = "";
      let n = c;
      while (n >= 0) {
        col = String.fromCharCode(65 + (n % 26)) + col;
        n = Math.floor(n / 26) - 1;
      }
      const addr = col + (r + 1);
      const x = xws[addr];
      if (!x?.f) continue;
      const tmpl = x.f
        .replace(/\$([A-Z]+)\$(\d+)/g, "$$$1$REF")
        .replace(/([A-Z]+)(\d+)/g, "$1N");
      if (!uniqueFormulas.has(tmpl)) {
        uniqueFormulas.set(tmpl, { count: 0, col, raw: x.f.replace(/\d+/g, "N").replace(/\$([A-Z]+)\$\d+/g, "$$$1$REF") });
      }
      uniqueFormulas.get(tmpl).count++;
    }
  }
}

md += `| # | Col | Formula Template | Count | Dev output field |
|---|-----|------------------|-------|------------------|
`;

let idx = 1;
for (const [, v] of [...uniqueFormulas.entries()].sort((a, b) => a[1].col.localeCompare(b[1].col))) {
  const m = COLUMN_FIELD_MAP[v.col];
  md += `| ${idx++} | ${v.col} | \`${v.raw}\` | ${v.count} | \`${m?.field ?? "—"}\` |\n`;
}

md += `
---

*Generated by \`scripts/analyze-cost-price-ods.mjs\` + \`scripts/generate-cost-price-fts.mjs\` v${VERSION} from \`${sourceName}\`.*
`;

const outPath = path.join(
  __dirname,
  `../docs/FunctionTechnicalSpecification-CostPrice-20260529-v${VERSION}.md`,
);
fs.writeFileSync(outPath, md, "utf8");
console.log("Wrote", outPath, "length", md.length, "unique formulas", uniqueFormulas.size);
