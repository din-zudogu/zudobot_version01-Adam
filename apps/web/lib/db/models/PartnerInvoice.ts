import mongoose, { Schema, Document, Model } from "mongoose";

export type PartnerInvoiceStatus = "open" | "paid" | "void";

export interface IPartnerInvoiceLineItem {
  tenantId:       string;
  businessName:   string;
  planId:         string;
  memAddonId:     string;
  retAddonId:     string;
  partnerCostThb: number;
}

export interface IPartnerInvoice extends Document {
  // Ownership
  partnerId:           string;   // PartnerProfile._id
  partnerEmail:        string;
  partnerCompanyName:  string;
  // Billing period
  billingMonth:        number;   // 1–12
  billingYear:         number;
  // Line items
  lineItems:           IPartnerInvoiceLineItem[];
  subtotalThb:         number;
  vatThb:              number;   // 7%
  totalThb:            number;
  // Status & payment
  status:              PartnerInvoiceStatus;
  stripePaymentLinkId?: string;
  stripePaymentLinkUrl?: string;
  invoiceNumber:       string;   // ZINV-P-YYYY-NNNNNN
  issuedAt:            Date;
  dueDate:             Date;     // issuedAt + 7 days
  paidAt?:             Date;
  emailSentAt?:        Date;
  createdAt:           Date;
  updatedAt:           Date;
}

const LineItemSchema = new Schema<IPartnerInvoiceLineItem>(
  {
    tenantId:       { type: String, required: true },
    businessName:   { type: String, required: true },
    planId:         { type: String, required: true },
    memAddonId:     { type: String, required: true },
    retAddonId:     { type: String, required: true },
    partnerCostThb: { type: Number, required: true },
  },
  { _id: false }
);

const PartnerInvoiceSchema = new Schema<IPartnerInvoice>(
  {
    partnerId:           { type: String, required: true, index: true },
    partnerEmail:        { type: String, required: true },
    partnerCompanyName:  { type: String, required: true },
    billingMonth:        { type: Number, required: true },
    billingYear:         { type: Number, required: true },
    lineItems:           { type: [LineItemSchema], default: [] },
    subtotalThb:         { type: Number, default: 0 },
    vatThb:              { type: Number, default: 0 },
    totalThb:            { type: Number, default: 0 },
    status:              { type: String, enum: ["open","paid","void"], default: "open" },
    stripePaymentLinkId: { type: String },
    stripePaymentLinkUrl:{ type: String },
    invoiceNumber:       { type: String, required: true, unique: true },
    issuedAt:            { type: Date, required: true, default: () => new Date() },
    dueDate:             { type: Date, required: true },
    paidAt:              { type: Date },
    emailSentAt:         { type: Date },
  },
  { timestamps: true }
);

PartnerInvoiceSchema.index({ partnerId: 1, billingYear: 1, billingMonth: 1 }, { unique: true });

export async function nextPartnerInvoiceNumber(): Promise<string> {
  const year  = new Date().getFullYear();
  const count = await PartnerInvoiceModel.countDocuments({
    invoiceNumber: { $regex: `^ZINV-P-${year}-` },
  });
  const seq = String(count + 1).padStart(6, "0");
  return `ZINV-P-${year}-${seq}`;
}

export const PartnerInvoiceModel: Model<IPartnerInvoice> =
  mongoose.models.PartnerInvoice ??
  mongoose.model<IPartnerInvoice>("PartnerInvoice", PartnerInvoiceSchema);
