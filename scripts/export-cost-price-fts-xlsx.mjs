/**
 * Export Cost & Price FTS analysis to Excel (.xlsx)
 * Usage: node scripts/export-cost-price-fts-xlsx.mjs [output.xlsx]
 */
import { createRequire } from "module";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(
  path.join(__dirname, "../apps/web/package.json"),
);
const XLSX = require("xlsx");

const analysisPath = path.join(__dirname, "../docs/_ods_analysis_temp.json");
const defaultOut = path.join(
  __dirname,
  "../docs/FunctionTechnicalSpecification-CostPrice-20260529-v1.0.0.xlsx",
);

const analysis = JSON.parse(fs.readFileSync(analysisPath, "utf8"));
const COL_ORDER = Object.keys(analysis.headers).sort(
  (a, b) => analysis.headers[a].colIndex - analysis.headers[b].colIndex,
);

const COLUMN_PURPOSE = {
  A: "ระบุกลุ่มแผน (Plan)",
  B: "ชื่อแพ็กเกจย่อย (Package)",
  C: "Base หรือ Add-on",
  D: "Storage Expire (วัน) — Expired Add-on",
  E: "ช่วงทดลอง AI BASE (วัน)",
  F: "ตัวคูณรอบบิล (เดือน): 0/1/6/12",
  G: "ตัวคูณ zudobot benefit (× AR → I)",
  H: "partner %benefit แสดงผล (0.45) — ไม่ใช้ใน chain หลัก",
  I: "zudobot benefit THB = G × AR",
  J: "Partner benefit THB = I − (I × K)",
  K: "Partner % benefit (0.35)",
  L: "zudobot % benefit หลัง partner = O/N",
  M: "zudobot benefit หลัง partner THB = N − O",
  N: "ราคา/เดือน Zudobot = I + AR",
  O: "ราคา/เดือน Partner = N − (N × K)",
  P: "ราคา Zudobot รวม WHT 3% ก่อน VAT = N + Y",
  Q: "ราคา Partner รวม WHT 3% ก่อน VAT = O + Z",
  R: "อัตราส่วนลด",
  S: "ส่วนลด Zudobot THB = P × R",
  T: "ส่วนลด Partner THB = Q × R",
  U: "ราคาหลังส่วนลด Zudobot = P − S",
  V: "ราคาหลังส่วนลด Partner = Q − T",
  W: "VAT 7% Zudobot — U×7% (แถว4-6) หรือ N×7%",
  X: "VAT 7% Partner — V×7% หรือ O×7%",
  Y: "WHT 3% Zudobot = N × 3%",
  Z: "WHT 3% Partner = O × 3%",
  AA: "ราคาขายหลัง VAT Zudobot = P + W",
  AB: "ราคาขายหลัง VAT Partner = Q + X",
  AC: "Best Price / FINAL Zudobot (Manual)",
  AD: "Best Price / FINAL Partner (Manual)",
  AE: "Best Price flag Y/N",
  AF: "Trial flag Y/N",
  AG: "Estimate Partner Benefit THB = AC − AD",
  AH: "Estimate Partner % = (AG × 100) / AC",
  AI: "Unit cost AI Core / message",
  AJ: "Unit cost MongoDB",
  AK: "Unit cost AWS",
  AL: "Unit cost S3",
  AM: "Unit cost VAT ตปท.",
  AN: "Unit cost FX Risk",
  AO: "Unit cost Payment Gateway",
  AP: "ต้นทุน / token",
  AQ: "ต้นทุน / MB retention",
  AR: "ต้นทุนรวม ROUNDUP(AS) หรือ $AR$base×F",
  AS: "SUM(AT:BD)",
  AT: "ต้นทุน AI Core เดือน = AI × $BJ$3",
  AU: "MongoDB × $BJ$3",
  AV: "AWS × $BJ$3",
  AW: "S3 × $BJ$3",
  AX: "VAT × $BJ$3",
  AY: "FX × $BJ$3",
  AZ: "Payment GW × $BJ$3",
  BA: "Token usage = BE × AP",
  BB: "Storage = BP × BN",
  BC: "Retention = BM × AQ",
  BD: "Placeholder ใน SUM",
  BE: "BF + BG",
  BF: "BI × BJ",
  BG: "History token pool",
  BH: "Divisor (1)",
  BI: "Token / message",
  BJ: "จำนวนข้อความ — anchor $BJ$3=200",
  BK: "(BI × BL) × D",
  BL: "คนคุย/วัน",
  BM: "(BK/BI) × 7 (หรือ ×D)",
  BN: "Storage cost / MB",
  BO: "MB / ประโยค",
  BP: "BO × BJ",
};

const COLUMN_SOURCE = {
  A: "Manual",
  B: "Manual",
  C: "Manual",
  D: "Manual",
  E: "Manual",
  F: "Manual",
  G: "Manual",
  H: "Formula (display only)",
  I: "Formula",
  J: "Formula",
  K: "Manual",
  L: "Formula",
  M: "Formula",
  N: "Formula",
  O: "Formula",
  P: "Formula",
  Q: "Formula",
  R: "Manual",
  S: "Formula",
  T: "Formula",
  U: "Formula",
  V: "Formula",
  W: "Formula",
  X: "Formula",
  Y: "Formula",
  Z: "Formula",
  AA: "Formula",
  AB: "Formula",
  AC: "Manual",
  AD: "Manual",
  AE: "Manual",
  AF: "Manual",
  AG: "Formula",
  AH: "Formula",
  AI: "Manual",
  AJ: "Manual",
  AK: "Manual",
  AL: "Manual",
  AM: "Manual",
  AN: "Manual",
  AO: "Manual",
  AP: "Manual",
  AQ: "Manual",
  AR: "Formula",
  AS: "Formula",
  AT: "Formula / Manual",
  AU: "Formula / Manual",
  AV: "Formula / Manual",
  AW: "Formula / Manual",
  AX: "Formula / Manual",
  AY: "Formula / Manual",
  AZ: "Formula / Manual",
  BA: "Formula",
  BB: "Formula",
  BC: "Formula",
  BD: "—",
  BE: "Formula",
  BF: "Formula",
  BG: "Manual",
  BH: "Manual",
  BI: "Manual / Formula",
  BJ: "Manual",
  BK: "Formula",
  BL: "Manual",
  BM: "Formula",
  BN: "Manual",
  BO: "Manual",
  BP: "Formula",
};

function formulasText(patterns) {
  const f = patterns.filter((p) => p.formulaTemplate);
  if (!f.length) return "";
  return f
    .map(
      (p) =>
        `${p.formulaTemplate.replace(/\$\$([A-Z]+)\$REF/g, "$$$1$<base>").replace(/N/g, "r")} [${p.count} rows: ${p.sampleRows.join(",")}]`,
    )
    .join("\n");
}

function manualSamples(patterns) {
  const vals = patterns.filter((p) => p.isManualInput);
  if (!vals.length) return "";
  return [...new Set(vals.map((v) => v.sampleValue))].slice(0, 12).join(", ");
}

function sheetFromRows(rows) {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = rows[0]?.map((_, i) => {
    const maxLen = rows.reduce(
      (m, row) => Math.max(m, String(row[i] ?? "").length),
      10,
    );
    return { wch: Math.min(maxLen + 2, 80) };
  });
  return ws;
}

// --- Sheet 1: Overview ---
const overview = [
  ["Field", "Value"],
  ["Document ID", "FTS-ZUDOBOT-COSTPRICE-20260529-v1.0.0"],
  ["Version", "1.0.0"],
  ["Date", "2026-05-29"],
  ["Source ODS", "Zudobot_Calculate_Cost&Price-20260529.ods"],
  ["Sheet name", "AIBase-Cal-Cost&Price"],
  ["Dimensions", analysis.dimensions.range],
  ["Formula cells", analysis.stats.totalFormulaCells],
  ["Package rows", analysis.stats.totalDataRows],
  ["Runtime function", "fnc_cal_zdb_cost_price()"],
  ["Code path", "apps/web/lib/pricing/costPriceCalculator.ts"],
];

// --- Sheet 2: Packages ---
const pkgHeader = [
  "Row",
  "Plan (A)",
  "Package (B)",
  "Base/Add-on (C)",
  "D (days)",
  "E (trial days)",
  "F (months)",
  "Category",
];
const pkgRows = [pkgHeader];
for (const r of analysis.dataRows) {
  const plan = String(r.plan || "").toLowerCase();
  let cat = "Other";
  if (plan.includes("trial")) cat = "Trial";
  else if (plan.includes("storage")) cat = "Storage Add-on";
  else if (plan.includes("expired")) cat = "Expired Add-on";
  else if (plan.includes("ai base") || r.baseAddon === "Base") cat = "AI Base";
  pkgRows.push([
    r.row,
    r.plan,
    r.package,
    r.baseAddon,
    r.storageExpireDays ?? "",
    r.aiBaseDateE ?? "",
    r.aiBaseMonthsF ?? "",
    cat,
  ]);
}

// --- Sheet 3: Column Dictionary ---
const colHeader = [
  "Column",
  "Index",
  "Header Row 1",
  "Header Row 2",
  "Data Source",
  "Purpose",
  "Formula Cells",
  "Manual Cells",
  "Empty Cells",
  "Formulas (all patterns)",
  "Manual Sample Values",
];
const colRows = [colHeader];
for (const col of COL_ORDER) {
  const h = analysis.headers[col];
  const a = analysis.colAnalysis[col];
  colRows.push([
    col,
    h.colIndex,
    h.row1,
    h.row2,
    COLUMN_SOURCE[col] ?? "",
    COLUMN_PURPOSE[col] ?? "",
    a.formulaCells,
    a.valueCells,
    a.emptyCells,
    formulasText(a.patterns),
    manualSamples(a.patterns),
  ]);
}

// --- Sheet 4: Formula Templates (from ODS) ---
const odsPath =
  "C:/Users/luesa/Downloads/Zudobot_Calculate_Cost&Price-20260529.ods";
const odsWs = XLSX.readFile(odsPath, { cellFormula: true }).Sheets[
  "AIBase-Cal-Cost&amp;Price"
];
const odsRange = XLSX.utils.decode_range(odsWs["!ref"]);
function colLetter(n) {
  let s = "";
  n++;
  while (n > 0) {
    n--;
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26);
  }
  return s;
}
const unique = new Map();
for (let r = odsRange.s.r; r <= odsRange.e.r; r++) {
  for (let c = odsRange.s.c; c <= odsRange.e.c; c++) {
    const addr = colLetter(c) + (r + 1);
    const x = odsWs[addr];
    if (!x?.f) continue;
    const tmpl = x.f
      .replace(/\$([A-Z]+)\$(\d+)/g, "$$$1$REF")
      .replace(/([A-Z]+)(\d+)/g, "$1N");
    if (!unique.has(tmpl)) unique.set(tmpl, { count: 0, addrs: [], col: colLetter(c) });
    const u = unique.get(tmpl);
    u.count++;
    if (u.addrs.length < 5) u.addrs.push(addr);
  }
}
const formulaHeader = ["#", "Primary Column", "Template", "Cell Count", "Example Cells"];
const formulaRows = [formulaHeader];
let idx = 1;
for (const [tmpl, v] of [...unique.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  formulaRows.push([idx++, v.col, tmpl, v.count, v.addrs.join(", ")]);
}

// --- Sheet 5: AR Base References ---
const arRefs = [
  ["Child Rows", "Package", "Formula", "Base Row"],
  ["5-6", "Starter 6m/12m", "=$AR$4*F", 4],
  ["8-9", "Pro 6m/12m", "=$AR$7*F", 7],
  ["11-12", "Super 6m/12m", "=$AR$10*F", 10],
  ["14-15", "MAX 6m/12m", "=$AR$13*F", 13],
  ["18-19", "Storage begin", "=$AR$17*F", 17],
  ["21-22", "Storage Pro", "=$AR$20*F", 20],
  ["24-25", "Storage Super", "=$AR$23*F", 23],
  ["27-28", "Storage Max", "=$AR$26*F", 26],
];

// --- Sheet 6: Defaults ---
const defaults = [
  ["Parameter", "Column", "Default", "Notes"],
  ["AI Core unit", "AI", 0.16, "THB per message unit"],
  ["MongoDB unit", "AJ", 0.06, ""],
  ["AWS unit", "AK", 0.05, ""],
  ["S3 unit", "AL", 0.01, ""],
  ["VAT intl unit", "AM", 0.0196, ""],
  ["FX Risk unit", "AN", 0.007, "2.5%"],
  ["Payment GW unit", "AO", 0.04726, "3.4%"],
  ["Cost per token", "AP", 0.0000105, ""],
  ["Cost per MB", "AQ", 0.01, "Retention BC"],
  ["Message anchor", "BJ$3", 200, "Trial row 3"],
  ["Tokens per message", "BI", 2500, ""],
  ["History tokens", "BG", 10000, ""],
  ["MB per sentence", "BO", 8, ""],
  ["Storage cost/MB", "BN", 0.01, ""],
  ["Benefit multiplier", "G", 6, ""],
  ["Partner share", "K", 0.35, "35%"],
  ["WHT rate", "Y/Z", "3%", "On N/O"],
  ["VAT rate", "W/X", "7%", ""],
];

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, sheetFromRows(overview), "Overview");
XLSX.utils.book_append_sheet(wb, sheetFromRows(pkgRows), "Packages");
XLSX.utils.book_append_sheet(wb, sheetFromRows(colRows), "ColumnDictionary");
XLSX.utils.book_append_sheet(wb, sheetFromRows(formulaRows), "FormulaTemplates");
XLSX.utils.book_append_sheet(wb, sheetFromRows(arRefs), "AR_BaseReferences");
XLSX.utils.book_append_sheet(wb, sheetFromRows(defaults), "Defaults");

const outPath = process.argv[2] || defaultOut;
XLSX.writeFile(wb, outPath, { bookType: "xlsx" });
console.log("Exported:", outPath);

// Copy to Downloads
const dl = path.join(
  process.env.USERPROFILE || "",
  "Downloads",
  "FunctionTechnicalSpecification-CostPrice-20260529-v1.0.0.xlsx",
);
if (process.env.USERPROFILE) {
  fs.copyFileSync(outPath, dl);
  console.log("Copied:", dl);
}
