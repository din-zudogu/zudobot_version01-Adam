import mongoose, { Schema, Document } from "mongoose";

export type PurchaseStatus = "active" | "expired" | "cancelled";

export interface ITenantPurchase extends Document {
  tenantId: mongoose.Types.ObjectId;
  packageSlug: string;
  packageName: string;
  amount: number;        // THB paid
  purchasedAt: Date;
  validFrom: Date;
  validTo: Date | null;  // null = no expiry (e.g. one_time addons until quota used)
  status: PurchaseStatus;
  note: string;          // admin note or reference
}

const tenantPurchaseSchema = new Schema<ITenantPurchase>(
  {
    tenantId:    { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    packageSlug: { type: String, required: true },
    packageName: { type: String, required: true },
    amount:      { type: Number, required: true, min: 0 },
    purchasedAt: { type: Date, default: Date.now },
    validFrom:   { type: Date, required: true },
    validTo:     { type: Date, default: null },
    status:      { type: String, enum: ["active","expired","cancelled"], default: "active" },
    note:        { type: String, default: "" },
  },
  { timestamps: true }
);

tenantPurchaseSchema.index({ tenantId: 1, purchasedAt: -1 });
tenantPurchaseSchema.index({ tenantId: 1, status: 1 });

export default mongoose.models.TenantPurchase as mongoose.Model<ITenantPurchase> ||
  mongoose.model<ITenantPurchase>("TenantPurchase", tenantPurchaseSchema);
