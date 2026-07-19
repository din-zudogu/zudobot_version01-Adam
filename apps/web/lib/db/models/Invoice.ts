import mongoose, { Schema, Document, Model } from "mongoose";

export type InvoiceStatus = "draft" | "open" | "paid" | "uncollectible" | "void";

export interface IInvoice extends Document {
  tenantId:           string;
  subscriptionId:     string;    // ref Subscription._id
  stripeInvoiceId?:   string;
  invoiceNumber:      string;    // ZUD-YYYY-NNNNNN
  status:             InvoiceStatus;
  amountDueThb:       number;
  amountPaidThb:      number;
  vatThb:             number;
  whtThb:             number;
  totalThb:           number;
  // Thai tax fields
  taxInvoiceNumber?:  string;
  buyerTaxId?:        string;
  buyerAddress?:      string;
  // Dates
  issuedAt:           Date;
  dueDate:            Date;
  paidAt?:            Date;
  // PDF
  pdfUrl?:            string;
  createdAt:          Date;
  updatedAt:          Date;
}

const InvoiceSchema = new Schema<IInvoice>(
  {
    tenantId:          { type: String, required: true, index: true },
    subscriptionId:    { type: String, required: true },
    stripeInvoiceId:   { type: String, sparse: true },
    invoiceNumber:     { type: String, required: true, unique: true },
    status:            { type: String, enum: ["draft","open","paid","uncollectible","void"], default: "open" },
    amountDueThb:      { type: Number, default: 0 },
    amountPaidThb:     { type: Number, default: 0 },
    vatThb:            { type: Number, default: 0 },
    whtThb:            { type: Number, default: 0 },
    totalThb:          { type: Number, default: 0 },
    taxInvoiceNumber:  { type: String },
    buyerTaxId:        { type: String },
    buyerAddress:      { type: String },
    issuedAt:          { type: Date, required: true, default: () => new Date() },
    dueDate:           { type: Date, required: true },
    paidAt:            { type: Date },
    pdfUrl:            { type: String },
  },
  { timestamps: true }
);

// Auto-increment invoice number helper (called by service layer)
export async function nextInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await InvoiceModel.countDocuments({
    invoiceNumber: { $regex: `^ZUD-${year}-` },
  });
  const seq = String(count + 1).padStart(6, "0");
  return `ZUD-${year}-${seq}`;
}

export const InvoiceModel: Model<IInvoice> =
  mongoose.models.Invoice ??
  mongoose.model<IInvoice>("Invoice", InvoiceSchema);
