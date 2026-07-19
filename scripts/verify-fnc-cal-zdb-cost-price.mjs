/**
 * Quick parity check vs Excel rows 4, 5, 17, 35.
 * Run: node scripts/verify-fnc-cal-zdb-cost-price.mjs
 */
import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";

const require = createRequire(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "../apps/web/package.json"),
);

// Register ts via tsx if available; else use compiled — run from apps/web with npx tsx this file
const { fnc_cal_zdb_cost_price, DEFAULT_UNIT_COSTS } = await import(
  "../apps/web/lib/pricing/costPriceCalculator.ts"
);

function base(partial) {
  return {
    plan: "AI Base",
    packageName: "Starter",
    baseAddon: "Base",
    aiBaseMonths: 1,
    zudobotBenefitMultiplier: 6,
    partnerSharePct: 0.35,
    discountPct: 0,
    bestPriceZudobot: 799,
    bestPricePartner: 399,
    pricingMode: "unit_calc",
    ...DEFAULT_UNIT_COSTS,
    unitCostAnchorMessageCount: 200,
    messageCount: 1000,
    historyTokenCount: 10000,
    tokensPerMessage: 2500,
    tokenDivisor: 1,
    storageMbPerSentence: 8,
    storageCostPerMb: 0.01,
    includeRetentionStorageCost: false,
    ...partial,
  };
}

const cases = [
  [
    4,
    base({}),
    { AR: 98, I: 588, N: 686, AA: 756.0406 },
  ],
  [
    5,
    base({
      aiBaseMonths: 6,
      discountPct: 0.05,
      pricingMode: "reference_multiple",
      referenceUnitCostAq: 98,
    }),
    { AR: 588, I: 3528, N: 4116, AA: 4521.405419999999 },
  ],
  [
    17,
    base({
      plan: "Storage Add-on",
      packageName: "Storage begin",
      baseAddon: "Add-on",
      messageCount: 1500,
      costPerToken: 0,
    }),
    { AR: 191, N: 1337, AA: 1470.6999999999998 },
  ],
  [
    35,
    base({
      plan: "Expired Add-on",
      packageName: "Expired Pro",
      baseAddon: "Add-on",
      storageExpireDays: 7,
      messageCount: 5000,
      chatsPerDayEstimate: 250,
      includeRetentionStorageCost: true,
    }),
    { AR: 594, N: 4158, AA: 4573.8 },
  ],
];

let failed = 0;
for (const [row, inp, exp] of cases) {
  const c = fnc_cal_zdb_cost_price(inp);
  const map = {
    AR: c.totalCostAr,
    I: c.zudobotBenefitThb,
    N: c.priceMonthZudobot,
    AA: c.priceAfterVatZudobot,
  };
  console.log(`Row ${row}`);
  for (const [k, v] of Object.entries(exp)) {
    const got = map[k];
    const ok = Math.abs(got - v) < 0.02;
    if (!ok) failed++;
    console.log(`  ${k}: ${got} vs ${v} ${ok ? "OK" : "FAIL"}`);
  }
}
process.exit(failed > 0 ? 1 : 0);
