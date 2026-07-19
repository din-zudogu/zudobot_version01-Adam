/**
 * Fill empty input cells in Zudobot cost/price workbook.
 * Preserves every existing formula; only adds missing cells.
 *
 * Usage: node scripts/fill-zudobot-cost-price-xlsx.mjs [input.xlsx] [output.xlsx]
 */
import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";

const require = createRequire(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "../apps/web/package.json"),
);
const XLSX = require("xlsx");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_IN =
  "C:/Users/luesa/Downloads/Zudobot_Calculate_Cost&Price-20260529.xlsx";
const DEFAULT_OUT = path.join(
  __dirname,
  "../docs/Zudobot_Calculate_Cost&Price-20260529-filled.xlsx",
);

const UNIT_COSTS = {
  AH: 0.16,
  AI: 0.06,
  AJ: 0.05,
  AK: 0.01,
  AL: 0.0196,
  AM: 0.007,
  AN: 0.04726,
};

const PRICING_FORMULA_COLS = [
  "I",
  "J",
  "L",
  "M",
  "N",
  "O",
  "P",
  "Q",
  "S",
  "T",
  "U",
  "V",
  "W",
  "X",
  "Y",
  "Z",
  "AA",
  "AB",
  "AF",
  "AG",
];

/** Template row 4 → target row (adjust row numbers in formula) */
function pricingFormula(col, row) {
  const r = String(row);
  const map = {
    I: `G${r}*AQ${r}`,
    J: `I${r}-(I${r}*K${r})`,
    L: `((O${r}*100)/N${r})/100`,
    M: `N${r}-O${r}`,
    N: `I${r}+AQ${r}`,
    O: `N${r}-(N${r}*K${r})`,
    P: `N${r}+Y${r}`,
    Q: `O${r}+Z${r}`,
    S: `P${r}*R${r}`,
    T: `Q${r}*R${r}`,
    U: `P${r}-S${r}`,
    V: `Q${r}-T${r}`,
    W: `U${r}*7%`,
    X: `V${r}*7%`,
    Y: `N${r}*3%`,
    Z: `O${r}*3%`,
    AA: `P${r}+W${r}`,
    AB: `Q${r}+X${r}`,
    AF: `AC${r}-AD${r}`,
    AG: `(AF${r}*100)/AC${r}`,
  };
  return map[col];
}

function isEmpty(ws, addr) {
  const c = ws[addr];
  if (!c) return true;
  if (c.f) return false;
  return c.v === undefined || c.v === null || c.v === "";
}

function setFormula(ws, addr, formula) {
  if (!isEmpty(ws, addr)) return false;
  // SheetJS requires `v` on write; Excel recalculates on open.
  ws[addr] = { t: "n", f: formula, v: 0 };
  return true;
}

function setNumber(ws, addr, value) {
  if (!isEmpty(ws, addr)) return false;
  ws[addr] = { t: "n", v: value };
  return true;
}

function setString(ws, addr, value) {
  if (!isEmpty(ws, addr)) return false;
  ws[addr] = { t: "s", v: value };
  return true;
}

/** @param {"ai_base" | "storage_expired"} vatPattern */
function fillPricingRow(ws, row, opts = {}) {
  const {
    g = 6,
    k = 0.35,
    h = "(4500%)/100",
    r = 0,
    ac = 0,
    ad = 0,
    vatPattern = "ai_base",
  } = opts;
  const changes = [];
  const mark = (addr, ok) => {
    if (ok) changes.push(addr);
  };

  mark(`G${row}`, setNumber(ws, `G${row}`, g));
  mark(`H${row}`, setFormula(ws, `H${row}`, h));
  mark(`K${row}`, setNumber(ws, `K${row}`, k));
  mark(`R${row}`, setNumber(ws, `R${row}`, r));

  for (const col of PRICING_FORMULA_COLS) {
    let f = pricingFormula(col, row);
    if (vatPattern === "storage_expired") {
      if (col === "W") f = `N${row}*7%`;
      if (col === "X") f = `O${row}*7%`;
    }
    if (f) mark(`${col}${row}`, setFormula(ws, `${col}${row}`, f));
  }

  mark(`AC${row}`, setNumber(ws, `AC${row}`, ac));
  mark(`AD${row}`, setNumber(ws, `AD${row}`, ad));

  return changes;
}

function fillUnitCosts(ws, row) {
  const changes = [];
  for (const [col, val] of Object.entries(UNIT_COSTS)) {
    if (setNumber(ws, `${col}${row}`, val)) changes.push(`${col}${row}`);
  }
  return changes;
}

function main() {
  const inputPath = process.argv[2] || DEFAULT_IN;
  const outputPath = process.argv[3] || DEFAULT_OUT;

  const wb = XLSX.readFile(inputPath, {
    cellFormula: true,
    cellStyles: true,
    cellDates: true,
  });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const allChanges = [];

  // Row 3 — Trial 14 วัน (Base): pricing + best prices 0
  allChanges.push(
    ...fillPricingRow(ws, 3, { g: 6, k: 0.35, r: 0, ac: 0, ad: 0 }),
  );

  // Row 16 — Storage Trial: align with storage add-on rows
  if (setString(ws, "A16", "Storage Add-on")) allChanges.push("A16");
  allChanges.push(
    ...fillPricingRow(ws, 16, {
      g: 6,
      k: 0.35,
      r: 0,
      ac: 0,
      ad: 0,
      vatPattern: "storage_expired",
    }),
  );

  // Row 29 — Expired Trail (1 day): scale best prices from row 30 (7 days)
  if (setString(ws, "A29", "Expired Add-on")) allChanges.push("A29");
  const d30 = ws.D30?.v ?? 7;
  const d29 = ws.D29?.v ?? 1;
  const ac30 = ws.AC30?.v ?? 1_390_000;
  const ad30 = ws.AD30?.v ?? 750_000;
  const ac29 = Math.round((ac30 / d30) * d29);
  const ad29 = Math.round((ad30 / d30) * d29);
  allChanges.push(
    ...fillPricingRow(ws, 29, {
      g: 6,
      k: 0.35,
      r: 0,
      ac: ac29,
      ad: ad29,
      vatPattern: "storage_expired",
    }),
  );

  // Expired child rows: unit costs AH–AN only (AS–AY already populated)
  const expiredChildRows = [
    31, 32, 33, 34, 36, 37, 38, 39, 41, 42, 43, 44, 46, 47, 48, 49,
  ];
  for (const row of expiredChildRows) {
    allChanges.push(...fillUnitCosts(ws, row));
  }

  XLSX.writeFile(wb, outputPath, { cellFormula: true, bookType: "xlsx" });

  console.log(`Sheet: ${sheetName}`);
  console.log(`Input:  ${inputPath}`);
  console.log(`Output: ${outputPath}`);
  console.log(`Filled ${allChanges.length} cells:`);
  console.log(allChanges.join(", "));
}

main();
