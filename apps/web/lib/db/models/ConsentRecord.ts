/**
 * ConsentRecord — PDPA/GDPR audit log of a user accepting (or declining) a
 * legal document. One row per (session, document, decision). Kept for
 * compliance evidence: who/when/which version/accepted.
 */
import mongoose, { Schema, Document, Model } from "mongoose";
import type { LegalDocumentType } from "@/lib/db/models/LegalDocument";

export interface IConsentRecord extends Document {
  tenantId:     string;
  sessionId:    string;
  documentType: LegalDocumentType;
  version:      string;
  accepted:     boolean;
  ip?:          string;
  userAgent?:   string;
  createdAt:    Date;
}

const ConsentRecordSchema = new Schema<IConsentRecord>(
  {
    tenantId:     { type: String, required: true, index: true },
    sessionId:    { type: String, required: true, index: true },
    documentType: { type: String, enum: ["DATA_PROCESSING_AGREEMENT", "TENANT_TERMS_OF_SERVICE"], required: true },
    version:      { type: String, default: "" },
    accepted:     { type: Boolean, required: true },
    ip:           { type: String },
    userAgent:    { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const ConsentRecordModel: Model<IConsentRecord> =
  mongoose.models.ConsentRecord ??
  mongoose.model<IConsentRecord>("ConsentRecord", ConsentRecordSchema);

