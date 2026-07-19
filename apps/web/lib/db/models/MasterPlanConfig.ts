/**
 * MasterPlanConfig — Single Source of Truth for all Zudobot pricing tiers.
 *
 * Fully normalised (Atomic Data) per billing cycle variant.
 * Derived financial values (VAT, margins, profits) are never stored —
 * always computed at runtime via computePlanFinancials().
 */
import mongoose, { Schema, Document, Model } from "mongoose";

// ── Enums ─────────────────────────────────────────────────────────────────────

export type PlanCategory  = "BASE_PLAN" | "QUOTA_ADDON" | "RETENTION_ADDON";
export type SupportLevel  = "STANDARD"  | "PRIORITY";

// ── Interface ──────────────────────────────────────────────────────────────────

export interface IMasterPlanConfig extends Document {
  // ── Metadata ────────────────────────────────────────────────────────────────
  plan_code:            string;        // unique slug, e.g. 'base_starter_1m'
  plan_category:        PlanCategory;
  plan_tier:            string;        // 'Starter' | 'Growth' | 'Pro' | '+1,000 msg' | '30 Days' …
  billing_cycle_months: number;        // 1 | 6 | 12
  label_th:             string;        // Thai display name shown in UI
  is_active:            boolean;
  sort_order:           number;

  // ── Features & Entitlements ─────────────────────────────────────────────────
  message_quota:              number;  // msgs/month for BASE_PLAN; -1=unlimited; 0=n/a
  extra_message_quota:        number;  // additional msgs for QUOTA_ADDON; 0=n/a
  channel_connection_limit:   number;  // total FB+LINE channels; -1=unlimited; 0=n/a
  support_level:              SupportLevel;
  has_custom_knowledge_base:  boolean;
  retention_days:             number;  // 7=standard(base); 30|90=addon; 0=n/a

  // ── Financial & Pricing (all THB, excl. VAT unless noted) ───────────────────
  retail_price:          number;       // B2C retail (excl. VAT)
  partner_cost:          number;       // B2B wholesale partner pays Zudobot (excl. VAT)
  zudobot_internal_cost: number;       // AI + infra + ops cost estimate
  vat_rate:              number;       // stored for audit; always 0.07

  createdAt: Date;
  updatedAt: Date;
}

// ── Schema ─────────────────────────────────────────────────────────────────────

const MasterPlanConfigSchema = new Schema<IMasterPlanConfig>(
  {
    plan_code:            { type: String, required: true, unique: true },
    plan_category:        { type: String, enum: ["BASE_PLAN","QUOTA_ADDON","RETENTION_ADDON"], required: true },
    plan_tier:            { type: String, required: true },
    billing_cycle_months: { type: Number, required: true },
    label_th:             { type: String, required: true },
    is_active:            { type: Boolean, default: true },
    sort_order:           { type: Number, default: 0 },

    message_quota:              { type: Number, required: true },
    extra_message_quota:        { type: Number, required: true, default: 0 },
    channel_connection_limit:   { type: Number, required: true, default: 0 },
    support_level:              { type: String, enum: ["STANDARD","PRIORITY"], default: "STANDARD" },
    has_custom_knowledge_base:  { type: Boolean, default: false },
    retention_days:             { type: Number, required: true, default: 0 },

    retail_price:          { type: Number, required: true },
    partner_cost:          { type: Number, required: true },
    zudobot_internal_cost: { type: Number, required: true },
    vat_rate:              { type: Number, required: true, default: 0.07 },
  },
  { timestamps: true }
);

export const MasterPlanConfigModel: Model<IMasterPlanConfig> =
  (mongoose.models.MasterPlanConfig as Model<IMasterPlanConfig>) ??
  mongoose.model<IMasterPlanConfig>("MasterPlanConfig", MasterPlanConfigSchema);

// ── Derived Financial Calculator ───────────────────────────────────────────────

/** Returns all computed financial fields from atomic stored values. */
export function computePlanFinancials(plan: {
  retail_price: number;
  partner_cost: number;
  zudobot_internal_cost: number;
  vat_rate: number;
}) {
  const ceilTen = (n: number) => Math.ceil(n / 10) * 10;

  const vat_retail  = ceilTen(plan.retail_price  * plan.vat_rate);
  const vat_partner = ceilTen(plan.partner_cost   * plan.vat_rate);

  const retail_incl_vat  = plan.retail_price  + vat_retail;
  const partner_incl_vat = plan.partner_cost  + vat_partner;

  const partner_gross_profit     = plan.retail_price - plan.partner_cost;
  const partner_gross_margin_pct = plan.retail_price > 0
    ? partner_gross_profit / plan.retail_price
    : 0;

  const zudobot_profit_from_partner = plan.partner_cost  - plan.zudobot_internal_cost;
  const zudobot_profit_from_direct  = plan.retail_price  - plan.zudobot_internal_cost;

  return {
    vat_retail,
    vat_partner,
    retail_incl_vat,
    partner_incl_vat,
    partner_gross_profit,
    partner_gross_margin_pct,
    zudobot_profit_from_partner,
    zudobot_profit_from_direct,
  };
}
