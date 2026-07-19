import mongoose, { Schema, Document, Model } from "mongoose";
import type {
  AiModel,
  StorageProvider,
  PaymentMethod,
  EmailService,
  CostRateConfig,
} from "@/lib/pricing/costRateConstants";
import { getDefaultRateConfig } from "@/lib/pricing/costRateConstants";

// ─── Document Interface ───────────────────────────────────────────────────────

export interface IPricingRateMaster extends Document {
  label: string;
  note?: string;
  isDefault: boolean;
  effectiveDate: Date;

  // ── FX ────────────────────────────────────────────────────────────────────
  usdToThb: number;

  // ── AI Token Rates (THB per token) ────────────────────────────────────────
  // Formula: (USD_per_1M / 1_000_000) × usdToThb
  aiRates: Record<AiModel, { input: number; output: number }>;

  // ── Storage Rates (THB per MB per month) ──────────────────────────────────
  storageRates: Record<StorageProvider, number>;
  egressRates: Record<StorageProvider, number>;

  // ── Payment Gateway Rates (decimal, e.g. 0.0365 = 3.65%) ─────────────────
  gatewayRates: Record<PaymentMethod, number>;
  intlCardSurcharge: number;
  qrFlatRateThb: number;

  // ── Email / SMS / Infrastructure ──────────────────────────────────────────
  emailRates: Record<EmailService, number>;
  smsRateThb: number;
  serverlessFnRatePerReq: number;
  managedDbRatePerMb: number;
  domainComMonthlyThb: number;
  aiImageRatePerImage: number;

  // ── Default Markup Controls (applied when creating new scenarios) ─────────
  defaultBenefitMultiplier: number; // G column — Zudobot benefit ×N (e.g. 6)
  defaultPartnerSharePct: number;   // K column — Partner share (e.g. 0.35 = 35%)
  defaultDiscountPct: number;       // R column — Discount rate (e.g. 0.05 = 5%)

  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Sub-schemas ──────────────────────────────────────────────────────────────

const AiModelRateSchema = new Schema(
  { input: { type: Number, required: true }, output: { type: Number, required: true } },
  { _id: false },
);

// ─── Main Schema ──────────────────────────────────────────────────────────────

const PricingRateMasterSchema = new Schema<IPricingRateMaster>(
  {
    label:         { type: String, required: true, trim: true },
    note:          { type: String },
    isDefault:     { type: Boolean, default: false },
    effectiveDate: { type: Date, required: true, default: () => new Date() },

    usdToThb: { type: Number, required: true },

    aiRates: {
      type: new Schema(
        {
          haiku:  AiModelRateSchema,
          sonnet: AiModelRateSchema,
          opus:   AiModelRateSchema,
        },
        { _id: false },
      ),
      required: true,
    },

    storageRates: {
      type: new Schema(
        { b2: Number, wasabi: Number, r2: Number, s3: Number, gcs: Number },
        { _id: false },
      ),
      required: true,
    },
    egressRates: {
      type: new Schema(
        { b2: Number, wasabi: Number, r2: Number, s3: Number, gcs: Number },
        { _id: false },
      ),
      required: true,
    },

    gatewayRates: {
      type: new Schema(
        {
          stripe_card:      Number,
          stripe_promptpay: Number,
          stripe_intl:      Number,
          opn_card:         Number,
          opn_promptpay:    Number,
          qr:               Number,
        },
        { _id: false },
      ),
      required: true,
    },
    intlCardSurcharge: { type: Number, required: true },
    qrFlatRateThb:     { type: Number, required: true },

    emailRates: {
      type: new Schema(
        { ses: Number, sendgrid: Number, none: Number },
        { _id: false },
      ),
      required: true,
    },
    smsRateThb:             { type: Number, required: true },
    serverlessFnRatePerReq: { type: Number, required: true },
    managedDbRatePerMb:     { type: Number, required: true },
    domainComMonthlyThb:    { type: Number, required: true },
    aiImageRatePerImage:    { type: Number, required: true },

    defaultBenefitMultiplier: { type: Number, required: true, default: 6 },
    defaultPartnerSharePct:   { type: Number, required: true, default: 0.35 },
    defaultDiscountPct:       { type: Number, required: true, default: 0.05 },

    createdBy: { type: String },
  },
  { timestamps: true },
);

PricingRateMasterSchema.index({ isDefault: 1 });

export const PricingRateMasterModel: Model<IPricingRateMaster> =
  mongoose.models.PricingRateMaster ??
  mongoose.model<IPricingRateMaster>("PricingRateMaster", PricingRateMasterSchema);

// ─── Converter: IPricingRateMaster → CostRateConfig ──────────────────────────

export function masterToRateConfig(m: IPricingRateMaster): CostRateConfig {
  return {
    usdToThb:              m.usdToThb,
    aiTokenRates:          m.aiRates as CostRateConfig["aiTokenRates"],
    storageRatesPerMb:     m.storageRates as CostRateConfig["storageRatesPerMb"],
    egressRatesPerMb:      m.egressRates  as CostRateConfig["egressRatesPerMb"],
    gatewayRates:          m.gatewayRates as CostRateConfig["gatewayRates"],
    intlCardSurcharge:     m.intlCardSurcharge,
    qrFlatRateThb:         m.qrFlatRateThb,
    emailRatesPerEmail:    m.emailRates as CostRateConfig["emailRatesPerEmail"],
    smsRateThb:            m.smsRateThb,
    serverlessFnRatePerReq:m.serverlessFnRatePerReq,
    managedDbRatePerMb:    m.managedDbRatePerMb,
    domainComMonthlyThb:   m.domainComMonthlyThb,
    aiImageRatePerImage:   m.aiImageRatePerImage,
  };
}

// ─── Seed data: converts costRateConstants into a master record ───────────────

export function buildDefaultMasterSeedData(createdBy = "system"): Omit<IPricingRateMaster, keyof Document> {
  const def = getDefaultRateConfig();
  return {
    label: "Default Rates (May–Jun 2026)",
    note: "Seeded from costRateConstants.ts — update when provider pricing changes",
    isDefault: true,
    effectiveDate: new Date("2026-05-01"),

    usdToThb:  def.usdToThb,
    aiRates:   def.aiTokenRates as IPricingRateMaster["aiRates"],
    storageRates: def.storageRatesPerMb  as IPricingRateMaster["storageRates"],
    egressRates:  def.egressRatesPerMb   as IPricingRateMaster["egressRates"],
    gatewayRates: def.gatewayRates       as IPricingRateMaster["gatewayRates"],
    intlCardSurcharge:     def.intlCardSurcharge,
    qrFlatRateThb:         def.qrFlatRateThb,
    emailRates:            def.emailRatesPerEmail as IPricingRateMaster["emailRates"],
    smsRateThb:            def.smsRateThb,
    serverlessFnRatePerReq:def.serverlessFnRatePerReq,
    managedDbRatePerMb:    def.managedDbRatePerMb,
    domainComMonthlyThb:   def.domainComMonthlyThb,
    aiImageRatePerImage:   def.aiImageRatePerImage,

    defaultBenefitMultiplier: 6,
    defaultPartnerSharePct:   0.35,
    defaultDiscountPct:       0.05,

    createdBy,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}
