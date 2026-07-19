/**
 * Export Cost & Price FTS v1.1.0 to Word (.docx)
 * Source: Zudobot_Calculate_Cost&Price-20260529.xlsx
 * Usage: node scripts/export-cost-price-fts-docx.mjs [source.xlsx] [output.docx]
 */
import { createRequire } from "module";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(
  path.join(__dirname, "../apps/web/package.json"),
);
const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  PageBreak,
} = require("docx");
const XLSX = require("xlsx");

const VERSION = "1.1.0";
const DOC_ID = "FTS-ZUDOBOT-COSTPRICE-20260529-v1.1.0";
const DEFAULT_XLSX =
  "C:/Users/luesa/Downloads/Zudobot_Calculate_Cost&Price-20260529.xlsx";

const xlsxPath = process.argv[2] || DEFAULT_XLSX;
const analysisPath = path.join(__dirname, "../docs/_ods_analysis_temp.json");

if (!fs.existsSync(analysisPath)) {
  console.error("Run: node scripts/analyze-cost-price-ods.mjs", xlsxPath);
  process.exit(1);
}

const analysis = JSON.parse(fs.readFileSync(analysisPath, "utf8"));
const wb = XLSX.readFile(xlsxPath, { cellFormula: true });
const sheetName = wb.SheetNames[0];
const xws = wb.Sheets[sheetName];
const xRange = XLSX.utils.decode_range(xws["!ref"]);

const COL_ORDER = Object.keys(analysis.headers).sort(
  (a, b) => analysis.headers[a].colIndex - analysis.headers[b].colIndex,
);

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

function ynToBool(v) {
  if (v === true || v === false) return v;
  const s = String(v ?? "").trim().toUpperCase();
  return s === "Y" || s === "YES" || s === "TRUE" || s === "1";
}

function cellVal(row, col) {
  return xws[`${col}${row}`]?.v;
}

function buildPackageDescription(r) {
  const plan = r.plan || "";
  const pkg = r.package || "";
  const cat = planCategory(plan, r.baseAddon);
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
    parts.push(`แพ็กเกจ AI Base ระดับ ${pkg || "—"}`);
    if (months === 1) parts.push("สัญญาราย 1 เดือน");
    else if (months === 6) parts.push("สัญญา 6 เดือน (ส่วนลด R=5%)");
    else if (months === 12) parts.push("สัญญา 12 เดือน (ส่วนลด R=10%)");
    if (bj) parts.push(`โควต้า ${Number(bj).toLocaleString()} ข้อความ/เดือน`);
    parts.push("รวม token ย้อนหลัง, คำนวณต้นทุน AI+Cloud+Token");
    return parts.join(" · ");
  }
  if (cat === "Storage Add-on") {
    parts.push(`Add-on ขยายพื้นที่เก็บข้อความ — ${pkg || "—"}`);
    if (months) parts.push(`รอบบิล ${months} เดือน`);
    if (bj) parts.push(`รองรับ ~${Number(bj).toLocaleString()} ข้อความ`);
    parts.push("คิดต้นทุน storage BB=BP×BN");
    return parts.join(" · ");
  }
  if (cat === "Expired Add-on") {
    parts.push(`Add-on เก็บประวัติหลังหมดอายุ — ${pkg || "—"}`);
    if (days) parts.push(`ระยะเก็บ ${days} วัน (คอลัมน์ D)`);
    parts.push("คิด retention BC=BM×AQ และ storage BB");
    return parts.join(" · ");
  }
  return `${plan} ${pkg}`.trim();
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
    aeRaw: ae ?? "",
    afRaw: af ?? "",
    aeChecked: ynToBool(ae),
    afChecked: ynToBool(af),
    ac: cellVal(r.row, "AC") ?? "",
    ad: cellVal(r.row, "AD") ?? "",
    description: buildPackageDescription(r),
    shareKbDefault: defaultShareKb(r, ynToBool(ae), ynToBool(af)),
  };
});

const COLUMN_PURPOSE = {
  A: "ระบุกลุ่มแผน (Plan)",
  B: "ชื่อแพ็กเกจย่อย (Package)",
  C: "Base หรือ Add-on",
  D: "Storage Expire (วัน) — Expired",
  E: "ช่วงทดลอง (วัน)",
  F: "รอบบิล (เดือน): 0/1/6/12",
  G: "ตัวคูณ zudobot benefit (× AR → I)",
  H: "partner %benefit แสดงผล (4500%)/100=0.45 — ไม่ใช้ใน chain",
  I: "zudobot benefit THB = G × AR",
  J: "Partner benefit = I − (I × K)",
  K: "Partner % (0.35)",
  L: "zudobot % หลัง partner = O/N",
  M: "benefit THB หลัง partner = N − O",
  N: "ราคา/เดือน Zudobot = I + AR",
  O: "ราคา/เดือน Partner = N − (N × K)",
  P: "ราคา + WHT 3% ก่อน VAT = N + Y",
  Q: "ราคา Partner + WHT = O + Z",
  R: "ส่วนลด",
  S: "ส่วนลด Zudobot = P × R",
  T: "ส่วนลด Partner = Q × R",
  U: "หลังส่วนลด Zudobot",
  V: "หลังส่วนลด Partner",
  W: "VAT 7% — U×7% (Starter 4–6) หรือ N×7%",
  X: "VAT 7% Partner",
  Y: "WHT 3% = N × 3%",
  Z: "WHT 3% Partner = O × 3%",
  AA: "ราคาหลัง VAT Zudobot = P + W",
  AB: "ราคาหลัง VAT Partner = Q + X",
  AC: "FINAL Best Price Zudobot (THB) — กรอกเมื่อกำหนดราคาขาย",
  AD: "FINAL Best Price Partner (THB)",
  AE: "Best Price flag — **Checkbox Admin: Yes/No** (Excel Y/N)",
  AF: "Trial flag — **Checkbox Admin: Yes/No** (Excel Y/N)",
  AG: "กำไร Partner = AC − AD",
  AH: "% กำไร Partner = (AG×100)/AC",
  AI: "Unit cost AI Core",
  AJ: "Unit cost MongoDB",
  AK: "Unit cost AWS",
  AL: "Unit cost S3",
  AM: "Unit cost VAT ตปท.",
  AN: "Unit cost FX",
  AO: "Unit cost Payment GW",
  AP: "ต้นทุน/token",
  AQ: "ต้นทุน/MB retention",
  AR: "ต้นทุนรวม ROUNDUP(AS) หรือ $AR$base×F",
  AS: "SUM(AT:BD)",
  AT: "AI × $BJ$3",
  AU: "AJ × $BJ$3",
  AV: "AK × $BJ$3",
  AW: "AL × $BJ$3",
  AX: "AM × $BJ$3",
  AY: "AN × $BJ$3",
  AZ: "AO × $BJ$3",
  BA: "BE × AP",
  BB: "BP × BN",
  BC: "BM × AQ",
  BD: "Placeholder ใน SUM",
  BE: "BF + BG",
  BF: "BI × BJ",
  BG: "History tokens",
  BH: "Divisor",
  BI: "Token/ข้อความ",
  BJ: "จำนวนข้อความ — anchor $BJ$3=200",
  BK: "(BI×BL)×D",
  BL: "คนคุย/วัน",
  BM: "(BK/BI)×7",
  BN: "Storage cost/MB",
  BO: "MB/ประโยค",
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
  H: "Formula (display)",
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
  AC: "Manual — ราคา THB",
  AD: "Manual — ราคา THB",
  AE: "Manual — **Checkbox** (checked=Yes/Y, unchecked=No/N)",
  AF: "Manual — **Checkbox** (checked=Yes/Y, unchecked=No/N)",
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
  AT: "Formula/Manual",
  AU: "Formula/Manual",
  AV: "Formula/Manual",
  AW: "Formula/Manual",
  AX: "Formula/Manual",
  AY: "Formula/Manual",
  AZ: "Formula/Manual",
  BA: "Formula",
  BB: "Formula",
  BC: "Formula",
  BD: "—",
  BE: "Formula",
  BF: "Formula",
  BG: "Manual",
  BH: "Manual",
  BI: "Manual/Formula",
  BJ: "Manual",
  BK: "Formula",
  BL: "Manual",
  BM: "Formula",
  BN: "Manual",
  BO: "Manual",
  BP: "Formula",
};

function p(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 120 },
    alignment: opts.center ? AlignmentType.CENTER : undefined,
    heading: opts.heading,
    children: [
      new TextRun({
        text: String(text),
        bold: opts.bold,
        font: opts.mono ? "Consolas" : "Calibri",
        size: opts.size || 22,
      }),
    ],
  });
}

function cell(text, header = false) {
  return new TableCell({
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text: String(text ?? ""),
            bold: header,
            size: 18,
          }),
        ],
      }),
    ],
  });
}

function tableFromRows(rows) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map((row, i) =>
      new TableRow({ children: row.map((c) => cell(c, i === 0)) }),
    ),
  });
}

function formulasText(patterns) {
  const f = patterns.filter((x) => x.formulaTemplate);
  if (!f.length) return "— กรอกค่ามือ";
  return f
    .map((x) => {
      const tmpl = x.formulaTemplate
        .replace(/\$\$([A-Z]+)\$REF/g, "$$$1$<base>")
        .replace(/N/g, "r");
      return `${tmpl} [${x.count} แถว: ${x.sampleRows.join(", ")}]`;
    })
    .join("\n");
}

function manualText(patterns) {
  const vals = patterns.filter((x) => x.isManualInput);
  if (!vals.length) return "—";
  return [...new Set(vals.map((v) => String(v.sampleValue)))].slice(0, 12).join(", ");
}

const uniqueFormulas = new Map();
for (let r = xRange.s.r; r <= xRange.e.r; r++) {
  for (let c = xRange.s.c; c <= xRange.e.c; c++) {
    const addr = colLetter(c) + (r + 1);
    const x = xws[addr];
    if (!x?.f) continue;
    const tmpl = x.f
      .replace(/\$([A-Z]+)\$(\d+)/g, "$$$1$REF")
      .replace(/([A-Z]+)(\d+)/g, "$1N");
    if (!uniqueFormulas.has(tmpl)) {
      uniqueFormulas.set(tmpl, { count: 0, addrs: [], col: colLetter(c) });
    }
    const u = uniqueFormulas.get(tmpl);
    u.count++;
    if (u.addrs.length < 3) u.addrs.push(addr);
  }
}

const children = [];

children.push(
  p("ZUDOBOT — FUNCTION TECHNICAL SPECIFICATION", { bold: true, size: 32, center: true }),
  p("Cost & Price Calculator + Admin Package Metadata", { bold: true, size: 26, center: true }),
  p(""),
  p(`Document ID: ${DOC_ID}`),
  p(`Version: ${VERSION}  |  Date: 2026-05-29  |  Status: Active`),
  p(`Source: ${path.basename(xlsxPath)}`),
  p(`Sheet: ${sheetName}  |  Range: ${analysis.dimensions.range}`),
  p(`Formula cells: ${analysis.stats.totalFormulaCells}  |  Packages: ${analysis.stats.totalDataRows}`),
  p("Runtime: fnc_cal_zdb_cost_price()"),
  new Paragraph({ children: [new PageBreak()] }),
);

children.push(
  p("1) Document History", { heading: HeadingLevel.HEADING_1 }),
  tableFromRows([
    ["Version", "Date", "Summary"],
    ["1.0.0", "2026-05-29", "วิเคราะห์ 68 คอลัมน์ + 1,250 สูตร"],
    [
      "1.1.0",
      "2026-05-29",
      "เพิ่ม Package Description, Knowledge Base share, Checkbox spec สำหรับ AE/AF/Y-N, วิเคราะห์จาก XLSX",
    ],
  ]),
  p(""),
  p("2) Business Purpose", { heading: HeadingLevel.HEADING_1 }),
  p("• คำนวณต้นทุน-ราคา Zudobot ตาม Excel (AR, VAT, WHT, Partner share)"),
  p("• กำหนด Best Price (AC/AD) และ flag AE/AF ผ่าน Admin checkbox"),
  p("• อธิบายแพ็กเกจ (packageDescription) และเลือกแชร์เข้า Knowledge Base"),
  p("• ไม่กระทบ public pricing / Stripe โดยตรง — ใช้ sync แยกเมื่อ shareToKnowledgeBase=true"),
  p(""),
  p("3) Calculation Flow", { heading: HeadingLevel.HEADING_1 }),
  p("INPUT → COST (AT:BD, AR) → PRICE (I→AA) → MARKETING (AC/AD, AG) + FLAGS (AE/AF checkbox)"),
  p(""),
);

children.push(
  p("4) Package Catalog + Metadata", { heading: HeadingLevel.HEADING_1 }),
  p("4.1 รายการแพ็กเกจจาก Excel", { heading: HeadingLevel.HEADING_2 }),
  tableFromRows([
    ["Row", "Plan", "Package", "F", "AC", "AD", "AE☑", "AF☑", "KB default"],
    ...packageRows.map((r) => [
      r.row,
      r.plan,
      r.package,
      r.aiBaseMonthsF ?? "",
      r.ac,
      r.ad,
      r.aeChecked ? "Yes" : "No",
      r.afChecked ? "Yes" : "No",
      r.shareKbDefault ? "แนะนำ ✓" : "—",
    ]),
  ]),
  p(""),
  p("4.2 คำอธิบายแพ็กเกจ (packageDescription) — ช่องใหม่ใน Admin", { heading: HeadingLevel.HEADING_2 }),
  p("Admin สามารถแก้ไขคำอธิบายรายละเอียดต่อแพ็กเกจ (ไม่มีใน Excel — เป็น extension ของ FTS v1.1.0)"),
  tableFromRows([
    ["Row", "Package", "คำอธิบายเริ่มต้น (editable)"],
    ...packageRows.map((r) => [r.row, r.package || r.plan, r.description]),
  ]),
  p(""),
  p("4.3 Knowledge Base Sharing (shareToKnowledgeBase)", { heading: HeadingLevel.HEADING_2 }),
  p("Checkbox ใน Admin — checked = แชร์เข้า Zudobot Knowledge Base"),
  tableFromRows([
    ["เมื่อ checked", "ข้อมูลที่ sync ไป KB"],
    ["✓", "plan, packageName, packageDescription, baseAddon"],
    ["✓", "AC/AD (Best Price) ถ้ามีค่า > 0"],
    ["✓", "F (เดือน), D (วัน expired) ถ้ามี"],
    ["✓", "aeFlag (AE), afFlag (AF) เป็น boolean"],
    ["✗ ห้าม sync", "ต้นทุนภายใน AI–AR, unit costs, margin G/K, สูตรดิบ"],
  ]),
  p(""),
  p("4.4 หมวดหมู่แพ็กเกจ", { heading: HeadingLevel.HEADING_2 }),
  tableFromRows([
    ["หมวด", "แถว", "สิ่งที่ลูกค้าได้"],
    ["Trial", "3,16,29", "ทดลองใช้ — AF=Yes"],
    ["AI Base", "4–15", "AI Chat ตาม tier + รอบบิล"],
    ["Storage Add-on", "17–28", "พื้นที่เก็บข้อความเพิ่ม"],
    ["Expired Add-on", "30–49", "เก็บประวัติหลังหมดอายุตาม D วัน"],
  ]),
  new Paragraph({ children: [new PageBreak()] }),
);

children.push(
  p("5) Admin UI — Checkbox & Field Specification", { heading: HeadingLevel.HEADING_1 }),
  p("ค่า Yes/No ใน Excel (Y/N) **ต้อง map เป็น Checkbox** ใน Admin — checked=Yes, unchecked=No"),
  tableFromRows([
    ["Excel", "Admin field", "UI", "Checked", "Unchecked", "DB type"],
    ["AE", "isBestPriceHighlight", "Checkbox", "Yes (Y)", "No (N)", "boolean"],
    ["AF", "isTrialPackage", "Checkbox", "Yes (Y)", "No (N)", "boolean"],
    ["—", "shareToKnowledgeBase", "Checkbox", "true", "false", "boolean"],
    ["AC", "bestPriceZudobot", "Number (THB)", "—", "—", "number"],
    ["AD", "bestPricePartner", "Number (THB)", "—", "—", "number"],
    ["—", "packageDescription", "Textarea", "—", "—", "string"],
  ]),
  p(""),
  p("5.1 กฎ Best Price (AC/AD)", { heading: HeadingLevel.HEADING_2 }),
  p("• AC/AD เป็นช่องตัวเลขราคาขายสุดท้าย (FINAL Price) — กรอกมือเสมอเมื่อมีราคา"),
  p("• AE (Best Price flag) = checkbox บอกว่าแถวนี้เป็นแถวอ้างอิง Best Price ของ tier (Y ที่แถว 10,20,35)"),
  p("• AG/AH คำนวณจาก AC−AD อัตโนมัติ — ไม่ใช้ checkbox"),
  p("• Trial (AF=Yes): AC/AD มักเป็น 0 หรือว่าง"),
  p(""),
  p("5.2 ค่า AE/AF ในไฟล์ XLSX ปัจจุบัน", { heading: HeadingLevel.HEADING_2 }),
  tableFromRows([
    ["Column", "Yes (Y) rows", "ความหมาย"],
    ["AF", "3, 16, 29", "Trial package"],
    ["AE", "10, 20, 35", "Best Price highlight tier (Super 1mo, Storage Pro 1mo, Expired Pro 7d)"],
  ]),
  new Paragraph({ children: [new PageBreak()] }),
);

children.push(
  p("6) Column Dictionary (A–BP)", { heading: HeadingLevel.HEADING_1 }),
  p("ครบทุกคอลัมน์ — header แถว 1–2, ที่มา, วัตถุประสงค์, สูตร, ค่ามือ"),
  p(""),
);

for (const col of COL_ORDER) {
  const h = analysis.headers[col];
  const a = analysis.colAnalysis[col];
  const title = (h.row2 || col).replace(/\n/g, " / ");
  children.push(
    p(`${col} — ${title}`, { heading: HeadingLevel.HEADING_2 }),
    tableFromRows([
      ["หัวข้อ", "รายละเอียด"],
      ["Index", h.colIndex],
      ["Header แถว 1", h.row1 || "—"],
      ["Header แถว 2", h.row2.replace(/\n/g, " / ")],
      ["ที่มา", COLUMN_SOURCE[col] ?? "—"],
      ["วัตถุประสงค์", COLUMN_PURPOSE[col] ?? "—"],
      ["สูตร", `${a.formulaCells} เซลล์`],
      ["ค่ามือ", `${a.valueCells} เซลล์`],
    ]),
    p("สูตร:", { bold: true }),
    p(formulasText(a.patterns), { mono: true, size: 18 }),
    p("ค่ามือ: " + manualText(a.patterns)),
    p(""),
  );
}

children.push(new Paragraph({ children: [new PageBreak()] }));

children.push(
  p("7) Formula Reference", { heading: HeadingLevel.HEADING_1 }),
  tableFromRows([
    ["Col", "Template", "Purpose"],
    ["AR", "ROUNDUP(AS) | $AR$base×F", "Total cost"],
    ["I", "G×AR", "Benefit THB"],
    ["N", "I+AR", "Price/month"],
    ["P", "N+Y", "Incl WHT"],
    ["W", "U×7% | N×7%", "VAT"],
    ["AG", "AC−AD", "Partner profit"],
    ["AT", "AI×$BJ$3", "Unit cost scale"],
    ["BB", "BP×BN", "Storage"],
    ["BC", "BM×AQ", "Retention"],
  ]),
  p(""),
  p("8) Data Model Extension (MongoDB CostPriceScenario)", { heading: HeadingLevel.HEADING_1 }),
  tableFromRows([
    ["Field", "Type", "Source"],
    ["packageDescription", "string", "Admin textarea — NEW v1.1.0"],
    ["shareToKnowledgeBase", "boolean", "Admin checkbox — NEW v1.1.0"],
    ["isBestPriceHighlight", "boolean", "Excel AE → checkbox"],
    ["isTrialPackage", "boolean", "Excel AF → checkbox"],
    ["bestPriceZudobot", "number", "Excel AC"],
    ["bestPricePartner", "number", "Excel AD"],
    ["inputs.*", "object", "Calculator inputs"],
    ["calculated.*", "object", "fnc_cal_zdb_cost_price output"],
  ]),
  p(""),
  p("9) Security", { heading: HeadingLevel.HEADING_1 }),
  p("• Server-side recalc only • RBAC admin+/super_admin • KB sync ไม่รวมต้นทุนภายใน"),
  p(""),
  p(`Appendix — Formula Templates (${uniqueFormulas.size} / 1250 cells)`, {
    heading: HeadingLevel.HEADING_1,
  }),
  tableFromRows([
    ["#", "Col", "Template", "Count"],
    ...[...uniqueFormulas.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([tmpl, v], i) => [i + 1, v.col, tmpl, v.count]),
  ]),
);

const outPath =
  process.argv[3] ||
  path.join(__dirname, `../docs/FunctionTechnicalSpecification-CostPrice-20260529-v${VERSION}.docx`);

const doc = new Document({
  title: DOC_ID,
  sections: [{ children }],
});

const buffer = await Packer.toBuffer(doc);
fs.writeFileSync(outPath, buffer);
console.log("Exported:", outPath);

const dl = path.join(
  process.env.USERPROFILE || "",
  "Downloads",
  `FunctionTechnicalSpecification-CostPrice-20260529-v${VERSION}.docx`,
);
if (process.env.USERPROFILE) {
  fs.copyFileSync(outPath, dl);
  console.log("Copied:", dl);
}
