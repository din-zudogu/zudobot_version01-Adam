import { createRequire } from "module";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const require = createRequire(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "../apps/web/package.json"),
);
const XLSX = require("xlsx");

const fp = "C:/Users/luesa/Downloads/Zudobot_Calculate_Cost&Price-20260529.ods";
const ws = XLSX.readFile(fp, { cellFormula: true }).Sheets["AIBase-Cal-Cost&amp;Price"];
const range = XLSX.utils.decode_range(ws["!ref"]);

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
for (let r = range.s.r; r <= range.e.r; r++) {
  for (let c = range.s.c; c <= range.e.c; c++) {
    const addr = colLetter(c) + (r + 1);
    const x = ws[addr];
    if (!x?.f) continue;
    const tmpl = x.f
      .replace(/\$([A-Z]+)\$(\d+)/g, "$$$1$REF")
      .replace(/([A-Z]+)(\d+)/g, "$1N");
    if (!unique.has(tmpl)) unique.set(tmpl, { count: 0, addrs: [] });
    const u = unique.get(tmpl);
    u.count++;
    if (u.addrs.length < 3) u.addrs.push(addr);
  }
}

let md = `\n---\n\n## Appendix C — Unique Formula Templates (${unique.size} แบบ / 1,250 เซลล์)\n\n`;
md += "| # | Template | จำนวนเซลล์ | ตัวอย่าง |\n|---|----------|------------|----------|\n";
let i = 1;
for (const [tmpl, v] of [...unique.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  md += `| ${i++} | \`${tmpl}\` | ${v.count} | ${v.addrs.join(", ")} |\n`;
}

const docPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../docs/FunctionTechnicalSpecification-CostPrice-20260529-v1.0.0.md",
);

let base = fs.readFileSync(docPath, "utf8");
const cut = base.indexOf("\n---\n\n## Appendix C");
if (cut >= 0) base = base.slice(0, cut);

fs.writeFileSync(docPath, base + md);
console.log("Updated Appendix C with", unique.size, "templates");
