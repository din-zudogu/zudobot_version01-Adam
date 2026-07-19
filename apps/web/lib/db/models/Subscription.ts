import mongoose, { Schema, Document, Model } from "mongoose";

export type SubStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "paused";

export interface ISubscription extends Document {
  tenantId:            string;
  stripeCustomerId?:   string;
  stripeSubId?:        string;
  planId:              string;    // starter | pro | master | enterprise
  memoryAddonId:       string;    // free | small | medium | large
  retentionAddonId:    string;    // standard | 1month | 3months | 6months | lifetime
  // ── ReadyPackage (แพคเกจสำเร็จรูป) link — null = ซื้อแบบ plan ปกติ ──
  readyPackageId?:     string;    // ReadyPackage._id ที่ร้านค้านี้เลือกใช้
  readyPackageName?:   string;    // snapshot ชื่อแพคเกจ ณ ตอนซื้อ
  status:              SubStatus;
  currentPeriodStart?: Date;
  currentPeriodEnd?:   Date;
  cancelAtPeriodEnd:   boolean;
  // Payment method
  paymentMethod:       "card" | "promptpay";
  // Amounts (THB satang)
  basePriceThb:        number;
  memoryPriceThb:      number;
  retentionPriceThb:   number;
  totalThb:            number;
  // Grace period tracking
  graceStartedAt?:     Date;
  graceDueDate?:       Date;
  // ── PARTNER fields (null = RETAIL / direct purchase) ──────────────
  referredByPartnerId?:    string;   // PartnerProfile._id
  partnerStripeAccountId?: string;   // acct_xxx — connected account used at checkout
  partnerProvisioned:      boolean;  // true = partner registered this tenant directly (consolidated billing)
  purchasedByPartnerId?:   string;   // partner who last paid for this subscription period on behalf of tenant
  // Metadata
  cancelledAt?:        Date;
  createdAt:           Date;
  updatedAt:           Date;
}

const SubscriptionSchema = new Schema<ISubscription>(
  {
    tenantId:            { type: String, required: true, index: true },
    stripeCustomerId:    { type: String, index: true, sparse: true },
    stripeSubId:         { type: String, index: true, sparse: true },
    planId:              { type: String, required: true, default: "trial" },
    memoryAddonId:       { type: String, required: true, default: "free" },
    retentionAddonId:    { type: String, required: true, default: "standard" },
    readyPackageId:      { type: String, index: true, sparse: true },
    readyPackageName:    { type: String },
    status:              { type: String, enum: ["trialing","active","past_due","canceled","unpaid","paused"], default: "trialing" },
    currentPeriodStart:  { type: Date },
    currentPeriodEnd:    { type: Date },
    cancelAtPeriodEnd:   { type: Boolean, default: false },
    paymentMethod:       { type: String, enum: ["card","promptpay"], default: "card" },
    basePriceThb:        { type: Number, default: 0 },
    memoryPriceThb:      { type: Number, default: 0 },
    retentionPriceThb:   { type: Number, default: 0 },
    totalThb:            { type: Number, default: 0 },
    graceStartedAt:      { type: Date },
    graceDueDate:        { type: Date },
    // PARTNER fields
    referredByPartnerId:    { type: String, index: true, sparse: true },
    partnerStripeAccountId: { type: String },
    partnerProvisioned:     { type: Boolean, default: false },
    purchasedByPartnerId:   { type: String, index: true, sparse: true },
    cancelledAt:            { type: Date },
  },
  { timestamps: true }
);

export const SubscriptionModel: Model<ISubscription> =
  mongoose.models.Subscription ??
  mongoose.model<ISubscription>("Subscription", SubscriptionSchema);
