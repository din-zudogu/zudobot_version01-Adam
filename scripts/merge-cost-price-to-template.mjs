/**
 * Merge all rows from Zudobot_Calculate_Cost&Price workbook
 * into zudobot-cost-price system export template (CostPrice sheet).
 *
 * Usage:
 *   node scripts/merge-cost-price-to-template.mjs [source.xlsx] [template.xlsx] [output.xlsx]
 */
import { createRequire } from "module";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(__dirname, "../apps/web/package.json"));
const XLSX = require("xlsx");

const { fnc_zdb_cal_cost_price, DEFAULT_UNIT_COSTS, DEFAULT_UNIT_COST_ANCHOR_BJ } =
  await import("../apps/web/lib/pricing/costPriceCalculator.ts");
const { scenarioToExportRow, COST_PRICE_COLUMNS } = await import(
  "../apps/web/lib/pricing/costPriceSpreadsheet.ts",
);

const DEFAULT_SOURCE =
  "C:/Users/luesa/Downloads/Zudobot_Calculate_Cost&Price-20260529.xlsx";
const DEFAULT_TEMPLATE =
  "C:/Users/luesa/Downloads/zudobot-cost-price-2026-05-31.xlsx";
const DEFAULT_OUTPUT = path.join(
  __dirname,
  "../docs/zudobot-cost-price-2026-05-31-filled.xlsx",
);

const sourcePath = process.argv[2] || DEFAULT_SOURCE;
const templatePath = process.argv[3] || DEFAULT_TEMPLATE;
const outputPath = process.argv[4] || DEFAULT_OUTPUT;

const BASE_UNIT_ROWS = new Set([4, 7, 10, 13, 17, 20, 23, 26]);

function cellVal(ws, col, row) {
  return ws[`${col}${row}`]?.v;
}

function cellFormula(ws, col, row) {
  return ws[`${col}${row}`]?.f;
}

function num(v, fallback = 0) {
  if (v === undefined || v === null || v === "") return fallback;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : fallback;
}

function str(v) {
  return v == null ? "" : String(v).trim();
}

function ynBool(v) {
  return String(v ?? "")
    .trim()
    .toUpperCase() === "Y";
}

function inferPlan(a, b, c) {
  if (str(a)) return str(a);
  const pkg = str(b).toLowerCase();
  if (pkg.includes("storage")) return "Storage Add-on";
  if (pkg.includes("expired") || pkg.includes("trail")) return "Expired Add-on";
  if (str(c).toLowerCase() === "base") return "AI Base";
  return str(b) || "Unknown";
}

function parseRefBaseRow(arFormula) {
  if (!arFormula) return null;
  const m = arFormula.match(/\$AR\$(\d+)\s*\*/i);
  return m ? parseInt(m[1], 10) : null;
}

function planCategory(plan, baseAddon, packageName) {
  const pl = plan.toLowerCase();
  const pkg = packageName.toLowerCase();
  if (pl.includes("trial") || pkg.includes("trial")) return "Trial";
  if (pl.includes("storage")) return "Storage Add-on";
  if (pl.includes("expired") || pkg.includes("expired") || pkg.includes("trail"))
    return "Expired Add-on";
  if (pl.includes("ai base") || baseAddon === "Base") return "AI Base";
  return "Other";
}

function buildPackageDescription(plan, packageName, baseAddon, row, ws) {
  const cat = planCategory(plan, baseAddon, packageName);
  const months = num(cellVal(ws, "F", row), NaN);
  const days = num(cellVal(ws, "D", row), NaN);
  const trialDays = num(cellVal(ws, "E", row), NaN);
  const bj = cellVal(ws, "BJ", row);
  const parts = [];

  if (cat === "Trial") {
    parts.push(`แพ็กเกจทดลอง ${Number.isFinite(trialDays) ? trialDays : 14} วัน`);
    parts.push("ใช้งาน AI Chat จำกัดโควต้า");
    if (bj) parts.push(`โควต้าประมาณ ${bj} ข้อความ`);
    parts.push("ไม่คิดราคาขาย (Best Price = 0)");
    return parts.join(" · ");
  }
  if (cat === "AI Base") {
    parts.push(`แพ็กเกจ AI Base ระดับ ${packageName || "—"}`);
    if (months === 1) parts.push("สัญญาราย 1 เดือน");
    else if (months === 6) parts.push("สัญญา 6 เดือน (ส่วนลด R=5%)");
    else if (months === 12) parts.push("สัญญา 12 เดือน (ส่วนลด R=10%)");
    if (bj) parts.push(`โควต้า ${Number(bj).toLocaleString()} ข้อความ/เดือน`);
    parts.push("รวม token ย้อนหลัง, คำนวณต้นทุน AI+Cloud+Token");
    return parts.join(" · ");
  }
  if (cat === "Storage Add-on") {
    parts.push(`Add-on ขยายพื้นที่เก็บข้อความ — ${packageName || "—"}`);
    if (Number.isFinite(months) && months > 0) parts.push(`รอบบิล ${months} เดือน`);
    if (bj) parts.push(`รองรับ ~${Number(bj).toLocaleString()} ข้อความ`);
    parts.push("คิดต้นทุน storage BB=BP×BN");
    return parts.join(" · ");
  }
  if (cat === "Expired Add-on") {
    parts.push(`Add-on เก็บประวัติหลังหมดอายุ — ${packageName || "—"}`);
    if (Number.isFinite(days) && days > 0) parts.push(`ระยะเก็บ ${days} วัน`);
    parts.push("คิด retention BC=BM×AQ และ storage BB");
    return parts.join(" · ");
  }
  return `${plan} ${packageName}`.trim();
}

function defaultShareKb(isTrial, isBestPrice, aiBaseMonths) {
  if (isTrial) return false;
  if (aiBaseMonths === 1 && !isBestPrice) return true;
  if (isBestPrice) return true;
  return false;
}

function buildLabel(plan, packageName, row, refBaseRow, aiBaseMonths, storageDays, isTrial) {
  if (isTrial && plan.toLowerCase().includes("trial")) return plan;
  if (isTrial && packageName) return packageName;

  const cat = planCategory(plan, "", packageName);
  if (cat === "Expired Add-on") {
    return `${plan} — ${packageName} (${storageDays} วัน)`;
  }
  if (refBaseRow != null) {
    return `${plan} — ${packageName} (${aiBaseMonths} เดือน)`;
  }
  if (BASE_UNIT_ROWS.has(row)) {
    if (cat === "Storage Add-on") {
      return `${plan} — ${packageName} (หน่วยต้นทุน)`;
    }
    return `${plan} — ${packageName} (หน่วยต้นทุน ${aiBaseMonths} เดือน)`;
  }
  return `${plan} — ${packageName}`.trim();
}

function readCol(ws, col, row, fallbackRow) {
  const v = cellVal(ws, col, row);
  if (v !== undefined && v !== null && v !== "") return v;
  if (fallbackRow) return cellVal(ws, col, fallbackRow);
  return undefined;
}

function excelRowToScenario(ws, row) {
  const a = str(cellVal(ws, "A", row));
  const b = str(cellVal(ws, "B", row));
  const c = str(cellVal(ws, "C", row)) || "Base";
  const plan = inferPlan(a, b, c);
  const packageName = b;
  const baseAddon = c;

  const arFormula = cellFormula(ws, "AR", row);
  const refBaseRow = parseRefBaseRow(arFormula);
  const isRef = refBaseRow != null;
  const fallbackRow = refBaseRow ?? row;

  const fRaw = cellVal(ws, "F", row);
  const aiBaseMonths =
    fRaw === undefined || fRaw === null || fRaw === "" ? 1 : num(fRaw, 1);

  const dRaw = cellVal(ws, "D", row);
  const storageExpireDays =
    dRaw === undefined || dRaw === null || dRaw === "" ? undefined : num(dRaw);

  const eRaw = cellVal(ws, "E", row);
  const trialDurationDays =
    eRaw === undefined || eRaw === null || eRaw === "" ? undefined : num(eRaw);

  const isTrialPackage = ynBool(cellVal(ws, "AF", row));
  const isBestPriceHighlight = ynBool(cellVal(ws, "AE", row));

  const cat = planCategory(plan, baseAddon, packageName);
  const includeRetentionStorageCost =
    cat === "Expired Add-on" && (storageExpireDays ?? 0) > 0;

  let referenceUnitCostAq;
  if (isRef && refBaseRow) {
    referenceUnitCostAq = num(cellVal(ws, "AR", refBaseRow));
  }

  const inputs = {
    ...DEFAULT_UNIT_COSTS,
    plan,
    packageName,
    baseAddon,
    storageExpireDays,
    trialDurationDays,
    aiBaseMonths,
    zudobotBenefitMultiplier: num(readCol(ws, "G", row, fallbackRow), 6),
    partnerSharePct: num(readCol(ws, "K", row, fallbackRow), 0.35),
    discountPct: num(readCol(ws, "R", row, fallbackRow), 0),
    bestPriceZudobot: num(cellVal(ws, "AC", row), 0),
    bestPricePartner: num(cellVal(ws, "AD", row), 0),
    pricingMode: isRef ? "reference_multiple" : "unit_calc",
    referenceUnitCostAq,
    unitCostAnchorMessageCount: num(cellVal(ws, "BJ", 3), DEFAULT_UNIT_COST_ANCHOR_BJ),
    unitCostAiCore: num(readCol(ws, "AI", row, fallbackRow), DEFAULT_UNIT_COSTS.unitCostAiCore),
    unitCostDatabase: num(readCol(ws, "AJ", row, fallbackRow), DEFAULT_UNIT_COSTS.unitCostDatabase),
    unitCostAws: num(readCol(ws, "AK", row, fallbackRow), DEFAULT_UNIT_COSTS.unitCostAws),
    unitCostS3: num(readCol(ws, "AL", row, fallbackRow), DEFAULT_UNIT_COSTS.unitCostS3),
    unitCostVatIntl: num(readCol(ws, "AM", row, fallbackRow), DEFAULT_UNIT_COSTS.unitCostVatIntl),
    unitCostFxRisk: num(readCol(ws, "AN", row, fallbackRow), DEFAULT_UNIT_COSTS.unitCostFxRisk),
    unitCostPaymentGateway: num(
      readCol(ws, "AO", row, fallbackRow),
      DEFAULT_UNIT_COSTS.unitCostPaymentGateway,
    ),
    costPerToken: num(readCol(ws, "AP", row, fallbackRow), DEFAULT_UNIT_COSTS.costPerToken),
    costPerMb: num(readCol(ws, "AQ", row, fallbackRow), DEFAULT_UNIT_COSTS.costPerMb),
    messageCount: num(readCol(ws, "BJ", row, fallbackRow), 1000),
    historyTokenCount: num(readCol(ws, "BG", row, fallbackRow), 0),
    tokensPerMessage: num(readCol(ws, "BI", row, fallbackRow), 2500),
    tokenDivisor: num(readCol(ws, "BH", row, fallbackRow), 1),
    storageMbPerSentence: num(readCol(ws, "BO", row, fallbackRow), 8),
    storageCostPerMb: num(readCol(ws, "BN", row, fallbackRow), 0.01),
    storedTokens: undefined,
    chatsPerDayEstimate:
      readCol(ws, "BL", row, fallbackRow) === undefined
        ? undefined
        : num(readCol(ws, "BL", row, fallbackRow)),
    includeRetentionStorageCost,
  };

  const calculated = fnc_zdb_cal_cost_price(inputs);

  const label = buildLabel(
    plan,
    packageName,
    row,
    refBaseRow,
    aiBaseMonths,
    storageExpireDays ?? 0,
    isTrialPackage,
  );

  const packageDescription = buildPackageDescription(
    plan,
    packageName,
    baseAddon,
    row,
    ws,
  );

  return {
    label,
    sortOrder: row,
    isActive: true,
    packageDescription,
    shareToKnowledgeBase: defaultShareKb(
      isTrialPackage,
      isBestPriceHighlight,
      aiBaseMonths,
    ),
    isBestPriceHighlight,
    isTrialPackage,
    inputs,
    calculated,
  };
}

function collectSourceRows(ws) {
  const rows = [];
  for (let row = 3; row <= 49; row++) {
    const a = cellVal(ws, "A", row);
    const b = cellVal(ws, "B", row);
    const c = cellVal(ws, "C", row);
    if (!a && !b && !c) continue;
    rows.push(row);
  }
  return rows;
}

function main() {
  if (!fs.existsSync(sourcePath)) {
    console.error("Source not found:", sourcePath);
    process.exit(1);
  }

  const srcWb = XLSX.readFile(sourcePath, { cellFormula: true });
  const srcSheet = srcWb.SheetNames[0];
  const srcWs = srcWb.Sheets[srcSheet];

  const sourceRows = collectSourceRows(srcWs);
  const scenarios = sourceRows.map((row) => excelRowToScenario(srcWs, row));
  const exportRows = scenarios.map((s) => scenarioToExportRow(s));

  // Validate template exists (optional — headers come from COST_PRICE_COLUMNS)
  let sheetName = "CostPrice";
  if (fs.existsSync(templatePath)) {
    const tplWb = XLSX.readFile(templatePath);
    sheetName = tplWb.SheetNames[0] || "CostPrice";
    console.log("Template:", path.basename(templatePath), "sheet:", sheetName);
  }

  const sheetData = [
    [...COST_PRICE_COLUMNS],
    ...exportRows.map((row) => COST_PRICE_COLUMNS.map((col) => row[col] ?? "")),
  ];

  const outWs = XLSX.utils.aoa_to_sheet(sheetData);
  const outWb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(outWb, outWs, sheetName);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  XLSX.writeFile(outWb, outputPath, { bookType: "xlsx" });

  const downloadsOut = path.join(
    process.env.USERPROFILE || "",
    "Downloads",
    path.basename(outputPath),
  );
  if (process.env.USERPROFILE) {
    fs.copyFileSync(outputPath, downloadsOut);
    console.log("Copied:", downloadsOut);
  }

  console.log("Source:", sourcePath, `(${sourceRows.length} rows)`);
  console.log("Output:", outputPath);
  console.log("Columns:", COST_PRICE_COLUMNS.length);
  console.log("Sample row 4 label:", exportRows[1]?.label);
  console.log("Sample row 4 AR:", exportRows[1]?.monthly_total_cost_aq);
}

main();
