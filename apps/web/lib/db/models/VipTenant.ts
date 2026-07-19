import mongoose, { Schema, Document, Model } from "mongoose";

export interface IVipTenant extends Document {
  // ── Identity ──────────────────────────────────────────────────────────────
  email: string;
  tenantId?: string;       // auto-linked from TenantProfile lookup
  tenantName?: string;     // snapshot from TenantProfile.businessName
  label: string;           // deal name e.g. "Enterprise Trial Q3 2026"
  note?: string;           // internal admin note

  // ── Quota ─────────────────────────────────────────────────────────────────
  baseAiQuota: number;         // AI message quota (messages/month)
  storageAddonQuota: number;   // Storage Add-on value
  expiredAddonQuota: number;   // Expired Add-on value

  // ── Duration ──────────────────────────────────────────────────────────────
  startDate: Date;
  endDate: Date;
  durationDays: number;        // derived from start–end (srv_expired_date_cal)

  // ── Pricing — Approach A (link to CostPriceScenario) ─────────────────────
  referenceScenarioId?: mongoose.Types.ObjectId;
  referenceScenarioLabel?: string;  // snapshot label for display

  // ── Pricing — Cost & VIP Price (A fills from scenario, C allows manual) ──
  totalCostAr: number;        // ต้นทุน (from scenario or manual)
  customVipPrice: number;     // ราคา VIP ที่ตั้ง (customised)

  // ── Pricing — Derived (auto-calculated on save) ───────────────────────────
  profitAmount: number;       // customVipPrice - totalCostAr
  profitPct: number;          // (profitAmount / customVipPrice) × 100
  vat7Amount: number;         // customVipPrice × 0.07
  wht3Amount: number;         // totalCostAr × 0.03

  // ── Control ───────────────────────────────────────────────────────────────
  autoRenew: boolean;
  isActive: boolean;
  createdBy: string;          // admin email (audit trail)
  createdAt: Date;
  updatedAt: Date;
}

const VipTenantSchema = new Schema<IVipTenant>(
  {
    email:                   { type: String, required: true, trim: true, lowercase: true },
    tenantId:                { type: String },
    tenantName:              { type: String },
    label:                   { type: String, required: true, trim: true },
    note:                    { type: String },

    baseAiQuota:             { type: Number, required: true, min: 0, default: 0 },
    storageAddonQuota:       { type: Number, required: true, min: 0, default: 0 },
    expiredAddonQuota:       { type: Number, required: true, min: 0, default: 0 },

    startDate:               { type: Date, required: true },
    endDate:                 { type: Date, required: true },
    durationDays:            { type: Number, required: true, min: 1 },

    referenceScenarioId:     { type: Schema.Types.ObjectId, ref: "CostPriceScenario" },
    referenceScenarioLabel:  { type: String },

    totalCostAr:             { type: Number, required: true, min: 0, default: 0 },
    customVipPrice:          { type: Number, required: true, min: 0, default: 0 },

    profitAmount:            { type: Number, default: 0 },
    profitPct:               { type: Number, default: 0 },
    vat7Amount:              { type: Number, default: 0 },
    wht3Amount:              { type: Number, default: 0 },

    autoRenew:               { type: Boolean, default: false },
    isActive:                { type: Boolean, default: true },
    createdBy:               { type: String, required: true },
  },
  { timestamps: true },
);

VipTenantSchema.index({ email: 1 });
VipTenantSchema.index({ endDate: 1 });
VipTenantSchema.index({ isActive: 1 });

export const VipTenantModel: Model<IVipTenant> =
  mongoose.models.VipTenant ??
  mongoose.model<IVipTenant>("VipTenant", VipTenantSchema);

// Re-export from pure utils so server-side API routes can import from one place
export { calcVipPricing } from "@/lib/pricing/vipPricingUtils";
