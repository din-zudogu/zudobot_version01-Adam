/**
 * LegalDocument — a legal/compliance document (PDPA/GDPR, Terms & Conditions)
 * displayed in the dashboard "เอกสาร" menu and the onboarding consent modal.
 * Only the ACTIVE version of each documentType is shown to users.
 */
import mongoose, { Schema, Document, Model } from "mongoose";

export type LegalDocumentType =
  | "DATA_PROCESSING_AGREEMENT"   // PDPA/GDPR
  | "TENANT_TERMS_OF_SERVICE";    // Terms & Conditions

export type LegalDocumentStatus = "ACTIVE" | "DRAFT" | "ARCHIVED";

export interface ILegalDocument extends Document {
  documentType: LegalDocumentType;
  title:        string;
  version:      string;
  content:      string;            // HTML
  status:       LegalDocumentStatus;
  effectiveAt?: Date;
  requiredForFeatures: string[];
  createdAt:    Date;
  updatedAt:    Date;
}

const LegalDocumentSchema = new Schema<ILegalDocument>(
  {
    documentType: { type: String, enum: ["DATA_PROCESSING_AGREEMENT", "TENANT_TERMS_OF_SERVICE"], required: true, index: true },
    title:        { type: String, required: true },
    version:      { type: String, default: "1.0" },
    content:      { type: String, required: true },
    status:       { type: String, enum: ["ACTIVE", "DRAFT", "ARCHIVED"], default: "ACTIVE", index: true },
    effectiveAt:  { type: Date },
    requiredForFeatures: { type: [String], default: [] },
  },
  { timestamps: true },
);

// One ACTIVE doc per type (partial unique).
LegalDocumentSchema.index(
  { documentType: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: "ACTIVE" } },
);

export const LegalDocumentModel: Model<ILegalDocument> =
  mongoose.models.LegalDocument ??
  mongoose.model<ILegalDocument>("LegalDocument", LegalDocumentSchema);

