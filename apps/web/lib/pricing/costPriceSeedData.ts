import type { CostPriceInputsV2 } from "./fnc_price_cost_cal_ai";
import { fnc_price_cost_cal_ai } from "./fnc_price_cost_cal_ai";

type SeedRow = {
  label: string;
  sortOrder: number;
  inputs: CostPriceInputsV2;
  referenceLabel?: string;
};

function baseInputs(
  partial: Partial<CostPriceInputsV2> & Pick<CostPriceInputsV2, "plan" | "packageName" | "baseAddon" | "aiBaseMonths">,
): CostPriceInputsV2 {
  return {
    pricingMode: "unit_calc",
    aiModel: "sonnet",
    inputTokensPerMessage: 2_500,
    outputTokensPerMessage: 750,
    historyTokensPerMonth: 10_000,
    promptCachingEnabled: false,
    batchProcessingEnabled: false,
    storageProvider: "b2",
    storageMbPerMonth: 8_000,
    egressMbPerMonth: 0,
    useCloudflareB2: true,
    paymentMethod: "stripe_card",
    monthlyTransactionAmountThb: 0,
    monthlyTransactionCount: 0,
    hasInternationalCard: false,
    emailService: "none",
    emailCountPerMonth: 0,
    smsCountPerMonth: 0,
    serverlessRequestsPerMonth: 0,
    managedDbMb: 0,
    aiImageCountPerMonth: 0,
    domainAmortized: false,
    zudobotBenefitMultiplier: 6,
    partnerSharePct: 0.35,
    discountPct: 0,
    bestPriceZudobot: 0,
    bestPricePartner: 0,
    messageCount: 1_000,
    includeRetentionStorageCost: false,
    ...partial,
  };
}

/** Rows mirrored from Excel `Zudobot_Calculate_Cost&Price-20260529.xlsx` (V2 inputs) */
export const COST_PRICE_SEED_ROWS: SeedRow[] = [
  {
    label: "Trial 14 วัน",
    sortOrder: 1,
    inputs: baseInputs({
      plan: "Trial 14 วัน",
      packageName: "",
      baseAddon: "Base",
      storageExpireDays: 14,
      aiBaseMonths: 1,
      messageCount: 200,
      inputTokensPerMessage: 2_500,
      outputTokensPerMessage: 750,
      historyTokensPerMonth: 0,
      bestPriceZudobot: 0,
      bestPricePartner: 0,
    }),
  },
  {
    label: "AI Base — Starter (หน่วยต้นทุน 1 เดือน)",
    sortOrder: 10,
    inputs: baseInputs({
      plan: "AI Base",
      packageName: "Starter",
      baseAddon: "Base",
      aiBaseMonths: 1,
      messageCount: 1_000,
      inputTokensPerMessage: 2_500,
      outputTokensPerMessage: 750,
      historyTokensPerMonth: 10_000,
      bestPriceZudobot: 799,
      bestPricePartner: 399,
    }),
  },
  {
    label: "AI Base — Starter (6 เดือน)",
    sortOrder: 11,
    referenceLabel: "AI Base — Starter (หน่วยต้นทุน 1 เดือน)",
    inputs: baseInputs({
      plan: "AI Base",
      packageName: "Starter",
      baseAddon: "Base",
      aiBaseMonths: 6,
      discountPct: 0.05,
      messageCount: 1_000,
      inputTokensPerMessage: 2_500,
      outputTokensPerMessage: 750,
      historyTokensPerMonth: 10_000,
      bestPriceZudobot: 4_699,
      bestPricePartner: 2_800,
      pricingMode: "reference_multiple",
      referenceUnitCostAq: 98,
    }),
  },
  {
    label: "AI Base — Starter (12 เดือน)",
    sortOrder: 12,
    referenceLabel: "AI Base — Starter (หน่วยต้นทุน 1 เดือน)",
    inputs: baseInputs({
      plan: "AI Base",
      packageName: "Starter",
      baseAddon: "Base",
      aiBaseMonths: 12,
      discountPct: 0.1,
      messageCount: 1_000,
      inputTokensPerMessage: 2_500,
      outputTokensPerMessage: 750,
      historyTokensPerMonth: 10_000,
      bestPriceZudobot: 9_190,
      bestPricePartner: 5_600,
      pricingMode: "reference_multiple",
      referenceUnitCostAq: 98,
    }),
  },
  {
    label: "AI Base — Pro (หน่วยต้นทุน 1 เดือน)",
    sortOrder: 20,
    inputs: baseInputs({
      plan: "AI Base",
      packageName: "Pro",
      baseAddon: "Base",
      aiBaseMonths: 1,
      messageCount: 5_000,
      inputTokensPerMessage: 2_500,
      outputTokensPerMessage: 750,
      historyTokensPerMonth: 10_000,
      bestPriceZudobot: 1_699,
      bestPricePartner: 990,
    }),
  },
  {
    label: "Storage Add-on — Storage begin (หน่วยต้นทุน)",
    sortOrder: 30,
    inputs: baseInputs({
      plan: "Storage Add-on",
      packageName: "Storage begin",
      baseAddon: "Add-on",
      aiBaseMonths: 1,
      messageCount: 1_500,
      inputTokensPerMessage: 2_500,
      outputTokensPerMessage: 750,
      historyTokensPerMonth: 10_000,
      storageMbPerMonth: 12_000,   // 1500 msgs × 8 MB/sentence
      bestPriceZudobot: 1_990,
      bestPricePartner: 900,
    }),
  },
  {
    label: "Expired Add-on — Expired Pro (7 วัน)",
    sortOrder: 40,
    inputs: baseInputs({
      plan: "Expired Add-on",
      packageName: "Expired Pro",
      baseAddon: "Add-on",
      storageExpireDays: 7,
      aiBaseMonths: 1,
      messageCount: 5_000,
      inputTokensPerMessage: 2_500,
      outputTokensPerMessage: 750,
      historyTokensPerMonth: 10_000,
      storageMbPerMonth: 40_000,   // 5000 msgs × 8 MB/sentence
      includeRetentionStorageCost: true,
      bestPriceZudobot: 4_900,
      bestPricePartner: 2_700,
    }),
  },
];

export function buildSeedDocuments() {
  const docs: Array<{
    label: string;
    sortOrder: number;
    inputs: CostPriceInputsV2;
    calculated: ReturnType<typeof fnc_price_cost_cal_ai>;
    referenceLabel?: string;
  }> = [];

  for (const row of COST_PRICE_SEED_ROWS) {
    const calculated = fnc_price_cost_cal_ai(row.inputs);
    docs.push({
      label: row.label,
      sortOrder: row.sortOrder,
      inputs: row.inputs,
      calculated,
      referenceLabel: row.referenceLabel,
    });
  }

  return docs;
}
