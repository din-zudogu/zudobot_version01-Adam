/**
 * fnc_price_cost_cal_ai — Zudobot Unified Cost & Price Calculator (V2)
 *
 * Replaces abstract per-message coefficients with bottom-up real provider rates.
 * Output is fully backward-compatible with CostPriceCalculated (V1 fields preserved).
 *
 * Rate source: costRateConstants.ts (ตารางต้นทุนจริง พ.ค.–มิ.ย. 2569)
 */

import type { CostPriceCalculated } from "./costPriceCalculator";
import {
  type AiModel,
  type StorageProvider,
  type PaymentMethod,
  type EmailService,
  type CostRateConfig,
  getDefaultRateConfig,
  PROMPT_CACHE_INPUT_MULTIPLIER,
  BATCH_PROCESSING_MULTIPLIER,
} from "./costRateConstants";

// ─── Input Schema (V2) ────────────────────────────────────────────────────────

export interface CostPriceInputsV2 {
  // ── Scenario context (V1-compatible) ──────────────────────────
  plan: string;
  packageName: string;
  baseAddon: "Base" | "Add-on" | string;
  aiBaseMonths: number;
  pricingMode: "unit_calc" | "reference_multiple";
  referenceUnitCostAq?: number;

  // ── AI Token ──────────────────────────────────────────────────
  aiModel: AiModel;
  inputTokensPerMessage: number;
  outputTokensPerMessage: number;
  historyTokensPerMonth?: number;
  promptCachingEnabled?: boolean;
  batchProcessingEnabled?: boolean;

  // ── Storage ───────────────────────────────────────────────────
  storageProvider: StorageProvider;
  storageMbPerMonth: number;
  egressMbPerMonth?: number;
  useCloudflareB2?: boolean;

  // ── Payment Gateway ───────────────────────────────────────────
  paymentMethod: PaymentMethod;
  monthlyTransactionAmountThb?: number;
  monthlyTransactionCount?: number;
  hasInternationalCard?: boolean;

  // ── Email ─────────────────────────────────────────────────────
  emailService?: EmailService;
  emailCountPerMonth?: number;

  // ── SMS ───────────────────────────────────────────────────────
  smsCountPerMonth?: number;

  // ── Infrastructure ────────────────────────────────────────────
  serverlessRequestsPerMonth?: number;
  managedDbMb?: number;
  aiImageCountPerMonth?: number;
  domainAmortized?: boolean;

  // ── Pricing controls (V1-compatible) ─────────────────────────
  messageCount: number;
  zudobotBenefitMultiplier: number;
  partnerSharePct: number;
  discountPct: number;
  bestPriceZudobot: number;
  bestPricePartner: number;
  storageExpireDays?: number;
  trialDurationDays?: number;
  includeRetentionStorageCost?: boolean;

  // ── FX / rate override ────────────────────────────────────────
  usdToThbOverride?: number;
  rateConfigOverride?: Partial<CostRateConfig>;

  // ── V1 per-message unit cost totals (injected by mapV1InputsToV2) ─────────
  // These carry the V1 abstract-coefficient costs that have no direct V2 provider
  // analogue (managed DB, serverless, VAT-intl, FX risk, payment gateway,
  // retention storage). When present they are added to totalCostRaw and used
  // to populate the V1 backward-compat output buckets.
  v1ExtraCosts?: {
    database:       number;  // unitCostDatabase × messageCount
    aws:            number;  // unitCostAws × messageCount
    vatIntl:        number;  // unitCostVatIntl × messageCount
    fxRisk:         number;  // unitCostFxRisk × messageCount
    paymentGateway: number;  // unitCostPaymentGateway × messageCount
    retention:      number;  // ceil(messageCount/30) × storageMbPerSentence × storageExpireDays × costPerMb (when enabled)
  };
}

// ─── V2 Cost Breakdown (nested inside CostPriceCalculated.v2) ────────────────

export interface CostBreakdownV2 {
  aiInputTokens: number;
  aiOutputTokens: number;
  storage: number;
  storageEgress: number;
  paymentGateway: number;
  email: number;
  sms: number;
  serverless: number;
  managedDb: number;
  aiImages: number;
  domain: number;
}

export interface RatesAuditV2 {
  usdToThb: number;
  aiModel: AiModel;
  inputRatePerToken: number;
  outputRatePerToken: number;
  storageProvider: StorageProvider;
  storageRatePerMb: number;
  egressRatePerMb: number;
  paymentMethod: PaymentMethod;
  effectiveGatewayRate: number | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

function roundUp(n: number): number {
  return Math.ceil(n);
}

function isAiBaseRow(inputs: CostPriceInputsV2): boolean {
  const t = `${inputs.plan} ${inputs.packageName}`.toLowerCase();
  return (
    String(inputs.baseAddon).toLowerCase() === "base" ||
    t.includes("ai base") ||
    t.includes("trial")
  );
}

function isStarterBase(inputs: CostPriceInputsV2): boolean {
  return (
    String(inputs.baseAddon).toLowerCase() === "base" &&
    String(inputs.packageName).toLowerCase() === "starter"
  );
}

// ─── Core Function ────────────────────────────────────────────────────────────

/**
 * fnc_price_cost_cal_ai — V2 unified calculator
 *
 * Returns CostPriceCalculated (fully V1-compatible) with an additional
 * `v2` field containing the itemised real-cost breakdown.
 */
export function fnc_price_cost_cal_ai(
  inputs: CostPriceInputsV2,
): CostPriceCalculated & { v2: { costBreakdown: CostBreakdownV2; ratesUsed: RatesAuditV2 } } {

  // ── 1. Resolve rate config ─────────────────────────────────────────────────
  const base = getDefaultRateConfig();
  const cfg: CostRateConfig = {
    ...base,
    ...(inputs.rateConfigOverride ?? {}),
    usdToThb: inputs.usdToThbOverride ?? base.usdToThb,
  };

  const aiRates = cfg.aiTokenRates[inputs.aiModel];

  // ── 2. AI Token cost ───────────────────────────────────────────────────────
  const inputMul  = (inputs.promptCachingEnabled  ? PROMPT_CACHE_INPUT_MULTIPLIER : 1)
                  * (inputs.batchProcessingEnabled ? BATCH_PROCESSING_MULTIPLIER  : 1);
  const outputMul =  inputs.batchProcessingEnabled ? BATCH_PROCESSING_MULTIPLIER  : 1;

  const effectiveInputRate  = aiRates.input  * inputMul;
  const effectiveOutputRate = aiRates.output * outputMul;

  const monthlyInputTokens  = (inputs.inputTokensPerMessage  * inputs.messageCount)
                            + (inputs.historyTokensPerMonth ?? 0);
  const monthlyOutputTokens =  inputs.outputTokensPerMessage * inputs.messageCount;

  const costAiInputTokens  = isAiBaseRow(inputs) ? monthlyInputTokens  * effectiveInputRate  : 0;
  const costAiOutputTokens = isAiBaseRow(inputs) ? monthlyOutputTokens * effectiveOutputRate : 0;

  // ── 3. Storage cost ────────────────────────────────────────────────────────
  const storageRatePerMb = cfg.storageRatesPerMb[inputs.storageProvider];
  const rawEgressRate    = cfg.egressRatesPerMb[inputs.storageProvider];
  const egressRatePerMb  = (inputs.storageProvider === "b2" && inputs.useCloudflareB2)
                         ? 0
                         : rawEgressRate;

  const costStorage      = inputs.storageMbPerMonth * storageRatePerMb;
  const costStorageEgress= (inputs.egressMbPerMonth ?? 0) * egressRatePerMb;

  // ── 4. Payment Gateway cost ────────────────────────────────────────────────
  let costGateway         = 0;
  let effectiveGatewayRate: number | null = null;

  if (inputs.paymentMethod === "qr") {
    costGateway          = (inputs.monthlyTransactionCount ?? 0) * cfg.qrFlatRateThb;
    effectiveGatewayRate = null;
  } else {
    let rate = cfg.gatewayRates[inputs.paymentMethod];
    if (inputs.hasInternationalCard) rate += cfg.intlCardSurcharge;
    effectiveGatewayRate = rate;
    costGateway          = (inputs.monthlyTransactionAmountThb ?? 0) * rate;
  }

  // ── 5. Email, SMS, Infra ───────────────────────────────────────────────────
  const emailSvc     = inputs.emailService ?? "none";
  const costEmail    = (inputs.emailCountPerMonth ?? 0) * cfg.emailRatesPerEmail[emailSvc];
  const costSms      = (inputs.smsCountPerMonth   ?? 0) * cfg.smsRateThb;
  const costServerless = (inputs.serverlessRequestsPerMonth ?? 0) * cfg.serverlessFnRatePerReq;
  const costManagedDb  = (inputs.managedDbMb ?? 0) * cfg.managedDbRatePerMb;
  const costAiImages   = (inputs.aiImageCountPerMonth ?? 0) * cfg.aiImageRatePerImage;
  const costDomain     = inputs.domainAmortized ? cfg.domainComMonthlyThb : 0;

  // ── 6. Total cost (monthly) ───────────────────────────────────────────────
  // V1 extras: per-message unit costs for infra + retention (no V2 provider equivalent)
  const v1e = inputs.v1ExtraCosts;
  const v1ExtraSum = v1e
    ? (v1e.database + v1e.aws + v1e.vatIntl + v1e.fxRisk + v1e.paymentGateway + v1e.retention)
    : 0;

  const totalCostRaw =
    costAiInputTokens + costAiOutputTokens +
    costStorage + costStorageEgress +
    costGateway +
    costEmail + costSms +
    costServerless + costManagedDb +
    costAiImages + costDomain +
    v1ExtraSum;

  // AR: ROUNDUP(totalCostRaw) — or reference_multiple mode
  let totalCostAr: number;
  if (
    inputs.pricingMode === "reference_multiple" &&
    inputs.referenceUnitCostAq != null &&
    inputs.referenceUnitCostAq > 0
  ) {
    totalCostAr = roundUp(inputs.referenceUnitCostAq * (inputs.aiBaseMonths || 1));
  } else {
    totalCostAr = roundUp(totalCostRaw);
  }

  // ── 7. Pricing calculations (V1 formulas preserved exactly) ───────────────
  const ar = totalCostAr;
  const g  = inputs.zudobotBenefitMultiplier;
  const k  = inputs.partnerSharePct;

  // I = G × AR
  const zudobotBenefitThb = g * ar;
  // J = I − (I × K)
  const partnerBenefitThb = zudobotBenefitThb - zudobotBenefitThb * k;
  // N = I + AR
  const priceMonthZudobot = zudobotBenefitThb + ar;
  // O = N − (N × K)
  const priceMonthPartner = priceMonthZudobot - priceMonthZudobot * k;
  // L = O/N
  const zudobotBenefitPctAfterPartner =
    priceMonthZudobot > 0 ? priceMonthPartner / priceMonthZudobot : 0;
  // M = N − O
  const zudobotBenefitAfterPartnerThb = priceMonthZudobot - priceMonthPartner;

  // WHT 3%: Y = N × 3%; Z = O × 3%
  const wht3Zudobot = priceMonthZudobot * 0.03;
  const wht3Partner = priceMonthPartner * 0.03;

  // P = N + Y; Q = O + Z
  const priceZudobotInclWhtBeforeVat = priceMonthZudobot + wht3Zudobot;
  const pricePartnerInclWhtBeforeVat = priceMonthPartner + wht3Partner;

  // Discount: S = P × R; T = Q × R
  const discount = inputs.discountPct || 0;
  const zudoguDiscountThb  = priceZudobotInclWhtBeforeVat * discount;
  const partnerDiscountThb = pricePartnerInclWhtBeforeVat * discount;
  const afterDiscountZudobot = priceZudobotInclWhtBeforeVat - zudoguDiscountThb;
  const afterDiscountPartner = pricePartnerInclWhtBeforeVat - partnerDiscountThb;

  // VAT 7%: AI Base Starter → U×7%; all others → N×7% (§9.4)
  const starterVat = isStarterBase(inputs);
  const vat7Zudobot = starterVat ? afterDiscountZudobot * 0.07 : priceMonthZudobot * 0.07;
  const vat7Partner = starterVat ? afterDiscountPartner * 0.07 : priceMonthPartner * 0.07;

  // AA = P + W; AB = Q + X
  const priceAfterVatZudobot = priceZudobotInclWhtBeforeVat + vat7Zudobot;
  const priceAfterVatPartner = pricePartnerInclWhtBeforeVat + vat7Partner;

  // AG = AC − AD; AH = (AG×100) / AC
  const estimatePartnerBenefitThb = inputs.bestPriceZudobot - inputs.bestPricePartner;
  const estimatePartnerBenefitPct =
    inputs.bestPriceZudobot > 0
      ? (estimatePartnerBenefitThb / inputs.bestPriceZudobot) * 100
      : 0;

  // ── 8. V1 backward-compat fields ──────────────────────────────────────────
  // When v1ExtraCosts is present (V1 form path), use those pre-computed values
  // for infra buckets so the form reflects every unit-cost input the user enters.
  // Without v1ExtraCosts (V2 direct path), fall back to real provider costs.
  const costAiCore         = r2(costAiInputTokens);
  const costMongoDb        = v1e ? r2(v1e.database)       : r2(costManagedDb);
  const costAws            = v1e ? r2(v1e.aws)            : r2(costServerless);
  const costS3             = r2(costStorage + costStorageEgress);
  const costVatIntl        = v1e ? r2(v1e.vatIntl)        : r2(costGateway);
  const costFxRisk         = v1e ? r2(v1e.fxRisk)         : 0;
  const costPaymentGateway = v1e ? r2(v1e.paymentGateway) : 0;
  const costTokenUsage     = r2(costAiOutputTokens);
  const costStorageUsage   = r2(costStorage);
  const costRetentionStorage = v1e ? r2(v1e.retention)    : r2(costStorageEgress);

  // Token/storage usage metrics (V1 fields)
  const tokenUsageMonth      = r2(inputs.inputTokensPerMessage * inputs.messageCount);
  const totalTokenUsageMonth = r2(monthlyInputTokens + monthlyOutputTokens);
  const storageUsageMb       = r2(inputs.storageMbPerMonth);
  const retentionStorageMb   = 0;

  // ── 9. V2 breakdown ───────────────────────────────────────────────────────
  const costBreakdown: CostBreakdownV2 = {
    aiInputTokens:  r2(costAiInputTokens),
    aiOutputTokens: r2(costAiOutputTokens),
    storage:        r2(costStorage),
    storageEgress:  r2(costStorageEgress),
    paymentGateway: r2(costGateway),
    email:          r2(costEmail),
    sms:            r2(costSms),
    serverless:     r2(costServerless),
    managedDb:      r2(costManagedDb),
    aiImages:       r2(costAiImages),
    domain:         r2(costDomain),
  };

  const ratesUsed: RatesAuditV2 = {
    usdToThb:           cfg.usdToThb,
    aiModel:            inputs.aiModel,
    inputRatePerToken:  effectiveInputRate,
    outputRatePerToken: effectiveOutputRate,
    storageProvider:    inputs.storageProvider,
    storageRatePerMb,
    egressRatePerMb,
    paymentMethod:      inputs.paymentMethod,
    effectiveGatewayRate,
  };

  return {
    // V1 abstract buckets (mapped)
    costAiCore,
    costMongoDb,
    costAws,
    costS3,
    costVatIntl,
    costFxRisk,
    costPaymentGateway,
    costTokenUsage,
    costStorageUsage,
    costRetentionStorage,
    totalCostRaw:    r2(totalCostRaw),
    totalCostAr:     r2(totalCostAr),
    monthlyTotalCost:r2(totalCostAr),

    // Pricing chain (V1 logic preserved exactly)
    zudobotBenefitThb:              r2(zudobotBenefitThb),
    partnerBenefitThb:              r2(partnerBenefitThb),
    zudobotBenefitPctAfterPartner:  r2(zudobotBenefitPctAfterPartner),
    zudobotBenefitAfterPartnerThb:  r2(zudobotBenefitAfterPartnerThb),
    priceMonthZudobot:              r2(priceMonthZudobot),
    priceMonthPartner:              r2(priceMonthPartner),
    priceZudobotInclWhtBeforeVat:   r2(priceZudobotInclWhtBeforeVat),
    pricePartnerInclWhtBeforeVat:   r2(pricePartnerInclWhtBeforeVat),
    zudoguDiscountThb:              r2(zudoguDiscountThb),
    partnerDiscountThb:             r2(partnerDiscountThb),
    afterDiscountZudobot:           r2(afterDiscountZudobot),
    afterDiscountPartner:           r2(afterDiscountPartner),
    vat7Zudobot:                    r2(vat7Zudobot),
    vat7Partner:                    r2(vat7Partner),
    wht3Zudobot:                    r2(wht3Zudobot),
    wht3Partner:                    r2(wht3Partner),
    priceAfterVatZudobot:           r2(priceAfterVatZudobot),
    priceAfterVatPartner:           r2(priceAfterVatPartner),
    estimatePartnerBenefitThb:      r2(estimatePartnerBenefitThb),
    estimatePartnerBenefitPct:      r2(estimatePartnerBenefitPct),

    // Usage metrics
    tokenUsageMonth,
    totalTokenUsageMonth,
    storageUsageMb,
    retentionStorageMb,

    // V2 itemised breakdown (new — optional for existing consumers)
    v2: { costBreakdown, ratesUsed },
  };
}

// ─── V1 → V2 input mapper ─────────────────────────────────────────────────────

import type { CostPriceInputs } from "./costPriceCalculator";

/**
 * Maps legacy V1 CostPriceInputs → CostPriceInputsV2.
 * Used by the deprecated V1 wrapper and the one-time DB migration script.
 *
 * Default assumptions when V1 fields have no direct V2 equivalent:
 *   aiModel        = "sonnet"   (Sonnet 4.6 was the production model at V1 launch)
 *   outputTokens   = input × 0.3  (conservative: output is ~30% of input volume)
 *   storageProvider= "b2"       (Backblaze B2 was the default storage)
 *   paymentMethod  = "stripe_card"
 */
export function mapV1InputsToV2(v1: CostPriceInputs): CostPriceInputsV2 {
  const inputTok  = v1.tokensPerMessage ?? 2500;
  const outputTok = Math.round(inputTok * 0.3);

  return {
    // Context
    plan:              v1.plan,
    packageName:       v1.packageName,
    baseAddon:         v1.baseAddon,
    aiBaseMonths:      v1.aiBaseMonths,
    pricingMode:       v1.pricingMode,
    referenceUnitCostAq: v1.referenceUnitCostAq,

    // AI Token
    aiModel:                 "sonnet",
    inputTokensPerMessage:   inputTok,
    outputTokensPerMessage:  outputTok,
    historyTokensPerMonth:   v1.historyTokenCount ?? 0,
    promptCachingEnabled:    false,
    batchProcessingEnabled:  false,

    // Storage — B2 as default, storageMbPerMonth from explicit override or sentence × message count
    storageProvider:   "b2",
    storageMbPerMonth: v1.storageMbPerMonth ?? (v1.storageMbPerSentence ?? 8) * (v1.messageCount ?? 1000),
    egressMbPerMonth:  0,
    useCloudflareB2:   true,   // assume Cloudflare CDN in front of B2

    // Payment — Stripe card as default; no transaction amount in V1
    paymentMethod:              "stripe_card",
    monthlyTransactionAmountThb: 0,
    monthlyTransactionCount:    0,
    hasInternationalCard:       false,

    // Email / SMS / Infra — V1 had no per-service data
    emailService:             "none",
    emailCountPerMonth:       0,
    smsCountPerMonth:         0,
    serverlessRequestsPerMonth:0,
    managedDbMb:              0,
    aiImageCountPerMonth:     0,
    domainAmortized:          false,

    // Pricing controls (direct carry-over)
    messageCount:             v1.messageCount,
    zudobotBenefitMultiplier: v1.zudobotBenefitMultiplier,
    partnerSharePct:          v1.partnerSharePct,
    discountPct:              v1.discountPct,
    bestPriceZudobot:         v1.bestPriceZudobot,
    bestPricePartner:         v1.bestPricePartner,
    storageExpireDays:        v1.storageExpireDays,
    trialDurationDays:        v1.trialDurationDays,
    includeRetentionStorageCost: v1.includeRetentionStorageCost,

    // V1 per-message unit cost totals — infra + retention (no V2 provider equivalent)
    v1ExtraCosts: {
      database:       r2((v1.unitCostDatabase       ?? 0) * (v1.messageCount ?? 0)),
      aws:            r2((v1.unitCostAws             ?? 0) * (v1.messageCount ?? 0)),
      vatIntl:        r2((v1.unitCostVatIntl         ?? 0) * (v1.messageCount ?? 0)),
      fxRisk:         r2((v1.unitCostFxRisk          ?? 0) * (v1.messageCount ?? 0)),
      paymentGateway: r2((v1.unitCostPaymentGateway  ?? 0) * (v1.messageCount ?? 0)),
      // Retention: ceil(messageCount/30) × storageMbPerSentence × storageExpireDays × costPerMb
      retention: (() => {
        if (!v1.includeRetentionStorageCost) return 0;
        const convsPerDay = Math.ceil((v1.messageCount ?? 0) / 30);
        const mbPerConv   = v1.storageMbPerSentence ?? 8;
        return r2(convsPerDay * mbPerConv * (v1.storageExpireDays ?? 0) * (v1.costPerMb ?? 0));
      })(),
    },
  };
}
