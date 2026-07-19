import mongoose, { Schema, Document, Model } from "mongoose";
import type { CostPriceInputsV2, CostBreakdownV2, RatesAuditV2 } from "@/lib/pricing/fnc_price_cost_cal_ai";
import type { CostPriceCalculated } from "@/lib/pricing/costPriceCalculator";

export interface ICostPriceScenario extends Document {
  plan_id?: string;
  label: string;
  packageDescription?: string;
  shareToKnowledgeBase?: boolean;
  isBestPriceHighlight?: boolean;
  isTrialPackage?: boolean;
  isOnSale?: boolean;
  isPartnerAllowed?: boolean;
  inputs: CostPriceInputsV2;
  calculated: CostPriceCalculated & {
    v2?: {
      costBreakdown: CostBreakdownV2;
      ratesUsed: RatesAuditV2;
    };
  };
  referenceScenarioId?: mongoose.Types.ObjectId;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CostPriceInputsSchema = new Schema(
  {
    // ── Context ───────────────────────────────────────────────────
    calculationType: { type: String, enum: ["ai_base", "storage", "expired"] },
    plan: String,
    packageName: String,
    baseAddon: String,
    aiBaseMonths: Number,
    pricingMode: { type: String, enum: ["unit_calc", "reference_multiple"] },
    referenceUnitCostAq: Number,

    // ── AI Token (V2) ─────────────────────────────────────────────
    aiModel: { type: String, enum: ["haiku", "sonnet", "opus"], default: "sonnet" },
    inputTokensPerMessage: Number,
    outputTokensPerMessage: Number,
    historyTokensPerMonth: Number,
    promptCachingEnabled: { type: Boolean, default: false },
    batchProcessingEnabled: { type: Boolean, default: false },

    // ── Storage (V2) ──────────────────────────────────────────────
    storageProvider: { type: String, enum: ["b2", "wasabi", "r2", "s3", "gcs"], default: "b2" },
    storageMbPerMonth: Number,
    egressMbPerMonth: Number,
    useCloudflareB2: { type: Boolean, default: true },

    // ── Payment Gateway (V2) ──────────────────────────────────────
    paymentMethod: {
      type: String,
      enum: ["stripe_card", "stripe_promptpay", "stripe_intl", "opn_card", "opn_promptpay", "qr"],
      default: "stripe_card",
    },
    monthlyTransactionAmountThb: Number,
    monthlyTransactionCount: Number,
    hasInternationalCard: { type: Boolean, default: false },

    // ── Email / SMS / Infra (V2) ──────────────────────────────────
    emailService: { type: String, enum: ["ses", "sendgrid", "none"], default: "none" },
    emailCountPerMonth: Number,
    smsCountPerMonth: Number,
    serverlessRequestsPerMonth: Number,
    managedDbMb: Number,
    aiImageCountPerMonth: Number,
    domainAmortized: { type: Boolean, default: false },

    // ── Pricing controls ──────────────────────────────────────────
    messageCount: Number,
    zudobotBenefitMultiplier: Number,
    partnerSharePct: Number,
    discountPct: Number,
    bestPriceZudobot: Number,
    bestPricePartner: Number,
    storageExpireDays: Number,
    trialDurationDays: Number,
    chatsPerDayEstimate: Number,
    storedTokens: Number,
    includeRetentionStorageCost: Boolean,

    // ── FX override ───────────────────────────────────────────────
    usdToThbOverride: Number,

    // ── V1 legacy fields (kept for migrated documents) ────────────
    historyTokenCount: Number,
    tokensPerMessage: Number,
    tokenDivisor: Number,
    storageMbPerSentence: Number,
    storageCostPerMb: Number,
    costPerToken: Number,
    costPerMb: Number,
    unitCostAnchorMessageCount: Number,
    unitCostAiCore: Number,
    unitCostDatabase: Number,
    unitCostAws: Number,
    unitCostS3: Number,
    unitCostVatIntl: Number,
    unitCostFxRisk: Number,
    unitCostPaymentGateway: Number,
  },
  { _id: false },
);

const CostPriceCalculatedSchema = new Schema(
  {
    costAiCore: Number,
    costMongoDb: Number,
    costAws: Number,
    costS3: Number,
    costVatIntl: Number,
    costFxRisk: Number,
    costPaymentGateway: Number,
    costTokenUsage: Number,
    costStorageUsage: Number,
    costRetentionStorage: Number,
    totalCostRaw: Number,
    totalCostAr: Number,
    monthlyTotalCost: Number,
    zudobotBenefitThb: Number,
    partnerBenefitThb: Number,
    zudobotBenefitPctAfterPartner: Number,
    zudobotBenefitAfterPartnerThb: Number,
    priceMonthZudobot: Number,
    priceMonthPartner: Number,
    priceZudobotInclWhtBeforeVat: Number,
    pricePartnerInclWhtBeforeVat: Number,
    zudoguDiscountThb: Number,
    partnerDiscountThb: Number,
    afterDiscountZudobot: Number,
    afterDiscountPartner: Number,
    vat7Zudobot: Number,
    vat7Partner: Number,
    wht3Zudobot: Number,
    wht3Partner: Number,
    priceAfterVatZudobot: Number,
    priceAfterVatPartner: Number,
    estimatePartnerBenefitThb: Number,
    estimatePartnerBenefitPct: Number,
    tokenUsageMonth: Number,
    totalTokenUsageMonth: Number,
    storageUsageMb: Number,
    retentionStorageMb: Number,
    storedTokensEffective: Number,
    // V2 itemised breakdown (optional — absent on pre-migration documents)
    v2: {
      type: new Schema(
        {
          costBreakdown: {
            type: new Schema(
              {
                aiInputTokens: Number,
                aiOutputTokens: Number,
                storage: Number,
                storageEgress: Number,
                paymentGateway: Number,
                email: Number,
                sms: Number,
                serverless: Number,
                managedDb: Number,
                aiImages: Number,
                domain: Number,
              },
              { _id: false },
            ),
          },
          ratesUsed: {
            type: new Schema(
              {
                usdToThb: Number,
                aiModel: String,
                inputRatePerToken: Number,
                outputRatePerToken: Number,
                storageProvider: String,
                storageRatePerMb: Number,
                egressRatePerMb: Number,
                paymentMethod: String,
                effectiveGatewayRate: Number,
              },
              { _id: false },
            ),
          },
        },
        { _id: false },
      ),
      required: false,
    },
  },
  { _id: false },
);

const CostPriceScenarioSchema = new Schema<ICostPriceScenario>(
  {
    plan_id: { type: String, sparse: true, unique: true },
    label: { type: String, required: true, trim: true },
    packageDescription: { type: String },
    shareToKnowledgeBase: { type: Boolean, default: false },
    isBestPriceHighlight: { type: Boolean, default: false },
    isTrialPackage: { type: Boolean, default: false },
    isOnSale: { type: Boolean, default: false },
    isPartnerAllowed: { type: Boolean, default: true },
    inputs: { type: CostPriceInputsSchema, required: true },
    calculated: { type: CostPriceCalculatedSchema, required: true },
    referenceScenarioId: { type: Schema.Types.ObjectId, ref: "CostPriceScenario" },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

CostPriceScenarioSchema.index({ "inputs.plan": 1, "inputs.packageName": 1 });

export const CostPriceScenarioModel: Model<ICostPriceScenario> =
  mongoose.models.CostPriceScenario ??
  mongoose.model<ICostPriceScenario>("CostPriceScenario", CostPriceScenarioSchema);

export async function generateUniquePlanId(): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const id = String(Math.floor(100000 + Math.random() * 900000));
    const exists = await CostPriceScenarioModel.exists({ plan_id: id });
    if (!exists) return id;
  }
  throw new Error("plan_id_generation_failed");
}
