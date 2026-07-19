/**
 * Extract full column/formula analysis from Zudobot cost-price ODS/XLSX.
 * Usage: node scripts/analyze-cost-price-ods.mjs [path.ods]
 */
import { createRequire } from "module";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const require = createRequire(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "../apps/web/package.json"),
);
const XLSX = require("xlsx");

const DEFAULT =
  "C:/Users/luesa/Downloads/Zudobot_Calculate_Cost&Price-20260529.ods";

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

function normalizeFormula(f) {
  return f
    .replace(/\$([A-Z]+)\$(\d+)/g, (_, col) => `$${col}$REF`)
    .replace(/\b([A-Z]+\d+)\b/g, (m) => {
      const col = m.replace(/\d+/, "");
      const row = m.replace(/[A-Z]+/, "");
      return `${col}N`;
    });
}

const fp = process.argv[2] || DEFAULT;
const wb = XLSX.readFile(fp, { cellFormula: true });
const sheetName = wb.SheetNames[0];
const ws = wb.Sheets[sheetName];
const range = XLSX.utils.decode_range(ws["!ref"]);

const headers = {};
for (let c = range.s.c; c <= range.e.c; c++) {
  const L = colLetter(c);
  headers[L] = {
    colIndex: c + 1,
    row1: String(ws[`${L}1`]?.v ?? "").trim(),
    row2: String(ws[`${L}2`]?.v ?? "").trim(),
  };
}

const colAnalysis = {};
for (let c = range.s.c; c <= range.e.c; c++) {
  const L = colLetter(c);
  const patterns = new Map();
  let formulaCells = 0;
  let valueCells = 0;
  let emptyCells = 0;

  for (let r = 2; r <= range.e.r; r++) {
    const addr = `${L}${r + 1}`;
    const x = ws[addr];
    if (!x || (x.v === undefined && !x.f)) {
      emptyCells++;
      continue;
    }
    if (x.f) {
      formulaCells++;
      const norm = normalizeFormula(x.f);
      if (!patterns.has(norm)) {
        patterns.set(norm, {
          formulaTemplate: x.f.replace(/\d+/g, "N").replace(/\$([A-Z]+)\$\d+/g, "$$$1$REF"),
          normalized: norm,
          count: 0,
          sampleRows: [],
          sampleValue: x.v,
        });
      }
      const p = patterns.get(norm);
      p.count++;
      if (p.sampleRows.length < 5) p.sampleRows.push(r + 1);
    } else {
      valueCells++;
      const key = `__VALUE__:${typeof x.v}:${String(x.v).slice(0, 40)}`;
      if (!patterns.has(key)) {
        patterns.set(key, {
          formulaTemplate: null,
          normalized: key,
          count: 0,
          sampleRows: [],
          sampleValue: x.v,
          isManualInput: true,
        });
      }
      patterns.get(key).count++;
    }
  }

  colAnalysis[L] = {
    formulaCells,
    valueCells,
    emptyCells,
    patterns: [...patterns.values()],
  };
}

const dataRows = [];
for (let r = 2; r <= range.e.r; r++) {
  const rowNum = r + 1;
  const A = ws[`A${rowNum}`]?.v;
  const B = ws[`B${rowNum}`]?.v;
  const C = ws[`C${rowNum}`]?.v;
  if (!A && !B && !C) continue;

  const cells = {};
  for (let c = range.s.c; c <= range.e.c; c++) {
    const L = colLetter(c);
    const x = ws[`${L}${rowNum}`];
    if (!x) continue;
    cells[L] = x.f ? { f: x.f, v: x.v } : { v: x.v };
  }

  dataRows.push({
    row: rowNum,
    plan: A ?? "",
    package: B ?? "",
    baseAddon: C ?? "",
    storageExpireDays: ws[`D${rowNum}`]?.v,
    aiBaseDateE: ws[`E${rowNum}`]?.v,
    aiBaseMonthsF: ws[`F${rowNum}`]?.v,
    cells,
  });
}

// Cross-column formula dependency summary
const allFormulas = [];
for (let r = 2; r <= range.e.r; r++) {
  for (let c = range.s.c; c <= range.e.c; c++) {
    const L = colLetter(c);
    const addr = `${L}${r + 1}`;
    const x = ws[addr];
    if (x?.f) allFormulas.push({ addr, f: x.f, v: x.v });
  }
}

const out = {
  sourceFile: path.basename(fp),
  sheetName,
  dimensions: { rows: range.e.r + 1, cols: range.e.c + 1, range: ws["!ref"] },
  headers,
  colAnalysis,
  dataRows,
  stats: {
    totalFormulaCells: allFormulas.length,
    totalDataRows: dataRows.length,
  },
};

const outPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../docs/_ods_analysis_temp.json",
);
fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log("Wrote", outPath);
console.log("Cols", Object.keys(headers).length, "Data rows", dataRows.length, "Formulas", allFormulas.length);
