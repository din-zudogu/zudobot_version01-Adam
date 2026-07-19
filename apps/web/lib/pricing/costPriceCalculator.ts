/**
 * Zudobot cost & price calculator
 *
 * V2 (current): fnc_price_cost_cal_ai — bottom-up real provider rates
 * V1 (deprecated): fnc_zdb_cal_cost_price — abstract per-message coefficients,
 *   now a thin wrapper that maps V1 inputs → V2 and delegates.
 *
 * All consumers should use fnc_price_cost_cal_ai directly.
 * fnc_zdb_cal_cost_price / fnc_cal_zdb_cost_price / calculateCostPrice are
 * kept for backward compatibility only.
 */

import {
  fnc_price_cost_cal_ai as _fnc_price_cost_cal_ai,
  mapV1InputsToV2 as _mapV1InputsToV2,
} from "./fnc_price_cost_cal_ai";

export type CostPricingMode = "unit_calc" | "reference_multiple";

export type CostPriceCalculationType = "ai_base" | "storage" | "expired";

/** User-editable inputs (atomic fields stored in MongoDB) */
export interface CostPriceInputs {
  /** Calculation category — determines which cost section this scenario belongs to */
  calculationType?: CostPriceCalculationType;
  plan: string;
  packageName: string;
  baseAddon: "Base" | "Add-on" | string;
  /** Column D — storage / expired retention days */
  storageExpireDays?: number;
  /** Column E — trial duration days (14 for Trial rows) */
  trialDurationDays?: number;
  /** Column F — billing cycle months multiplier */
  aiBaseMonths: number;

  /** Column G — benefit multiplier (e.g. 6) */
  zudobotBenefitMultiplier: number;
  /** Column K — partner share (0.35 = 35%) */
  partnerSharePct: number;
  /** Column R — discount rate on P/Q */
  discountPct: number;
  /** Columns AC / AD — marketing best prices (manual) */
  bestPriceZudobot: number;
  bestPricePartner: number;

  pricingMode: CostPricingMode;
  /** When reference_multiple: base row AR (rounded unit cost) × F */
  referenceUnitCostAq?: number;

  /** Excel $BJ$3 — anchor message count for AT:AZ unit costs (default Trial row = 200) */
  unitCostAnchorMessageCount?: number;

  /** Columns AI–AO — unit costs per message / token / payment */
  unitCostAiCore: number;
  unitCostDatabase: number;
  unitCostAws: number;
  unitCostS3: number;
  unitCostVatIntl: number;
  unitCostFxRisk: number;
  unitCostPaymentGateway: number;
  /** Column AP — cost per token */
  costPerToken: number;
  /** Column AQ — cost per MB (retention BC = BM × AQ) */
  costPerMb: number;

  /** Column BJ — message quota */
  messageCount: number;
  /** Column BG — history token pool */
  historyTokenCount: number;
  /** Column BI — tokens per message */
  tokensPerMessage: number;
  /** Column BH — divisor (usually 1) */
  tokenDivisor: number;

  /** Column BO — MB per sentence; BP = BO × BJ */
  storageMbPerSentence: number;
  /** Column BN — storage cost per MB; BB = BP × BN */
  storageCostPerMb: number;
  /** Total storage added per month (MB); overrides storageMbPerSentence × messageCount when set */
  storageMbPerMonth?: number;

  /** Column BK — stored tokens (optional; computed from (BI×BL)×D when omitted) */
  storedTokens?: number;
  /** Column BL — chats per day estimate (Expired) */
  chatsPerDayEstimate?: number;
  /** Enable BC = BM × AQ retention line */
  includeRetentionStorageCost: boolean;
}

/** All derived values from Excel formulas */
export interface CostPriceCalculated {
  costAiCore: number;
  costMongoDb: number;
  costAws: number;
  costS3: number;
  costVatIntl: number;
  costFxRisk: number;
  costPaymentGateway: number;
  costTokenUsage: number;
  costStorageUsage: number;
  costRetentionStorage: number;
  /** AS — raw sum before ROUNDUP */
  totalCostRaw: number;
  /** AR — ROUNDUP(AS); legacy field name `monthlyTotalCost` */
  totalCostAr: number;
  monthlyTotalCost: number;

  zudobotBenefitThb: number;
  partnerBenefitThb: number;
  zudobotBenefitPctAfterPartner: number;
  zudobotBenefitAfterPartnerThb: number;
  priceMonthZudobot: number;
  priceMonthPartner: number;
  priceZudobotInclWhtBeforeVat: number;
  pricePartnerInclWhtBeforeVat: number;
  zudoguDiscountThb: number;
  partnerDiscountThb: number;
  afterDiscountZudobot: number;
  afterDiscountPartner: number;
  vat7Zudobot: number;
  vat7Partner: number;
  wht3Zudobot: number;
  wht3Partner: number;
  priceAfterVatZudobot: number;
  priceAfterVatPartner: number;
  /** AG = AC − AD */
  estimatePartnerBenefitThb: number;
  /** AH = (AG×100)/AC */
  estimatePartnerBenefitPct: number;

  tokenUsageMonth: number;
  totalTokenUsageMonth: number;
  storageUsageMb: number;
  retentionStorageMb: number;
}

export const DEFAULT_UNIT_COSTS = {
  unitCostAiCore: 0.16,
  unitCostDatabase: 0.06,
  unitCostAws: 0.05,
  unitCostS3: 0.01,
  unitCostVatIntl: 0.0196,
  unitCostFxRisk: 0.007,
  unitCostPaymentGateway: 0.04726,
  costPerToken: 0.0000105,
  costPerMb: 0.01,
} as const;

export const DEFAULT_UNIT_COST_ANCHOR_BJ = 200;

/**
 * @deprecated Use fnc_price_cost_cal_ai directly.
 * This wrapper maps V1 CostPriceInputs → CostPriceInputsV2 and delegates to V2.
 * Kept for backward compatibility; all existing callers continue to work unchanged.
 */
export function fnc_zdb_cal_cost_price(inputs: CostPriceInputs): CostPriceCalculated {
  return _fnc_price_cost_cal_ai(_mapV1InputsToV2(inputs));
}

/** @deprecated Use fnc_price_cost_cal_ai */
export const fnc_cal_zdb_cost_price = fnc_zdb_cal_cost_price;

/** @deprecated Use fnc_price_cost_cal_ai */
export const calculateCostPrice = fnc_zdb_cal_cost_price;

// Re-export V2 as the canonical function
export { fnc_price_cost_cal_ai, mapV1InputsToV2 } from "./fnc_price_cost_cal_ai";
export type { CostPriceInputsV2, CostBreakdownV2, RatesAuditV2 } from "./fnc_price_cost_cal_ai";

export function thb(n: number): string {
  return `฿${n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function pct(n: number): string {
  return `${n.toFixed(1)}%`;
}
