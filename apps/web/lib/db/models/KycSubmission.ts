import mongoose, { Schema, Document, Model } from "mongoose";

export type KycStatus = "pending" | "approved" | "rejected" | "more_info_needed";

export interface IKycSubmission extends Document {
  tenantId:         string;
  // Business info
  legalName:        string;   // ชื่อนิติบุคคล
  taxId:            string;   // เลขประจำตัวผู้เสียภาษี 13 หลัก
  vatRegistered:    boolean;
  address:          string;   // ที่อยู่จดทะเบียน
  province:         string;
  postalCode:       string;
  contactName:      string;
  contactPhone:     string;
  // Documents (URLs — uploaded to S3/CDN)
  docBusinessCert?:    string;  // หนังสือรับรองบริษัท
  docVatCert?:         string;  // ใบทะเบียนภาษีมูลค่าเพิ่ม
  docSignedContract?:  string;  // สัญญาที่ลงนามแล้ว
  // Review
  status:           KycStatus;
  reviewNote?:      string;
  reviewedBy?:      string;   // admin userId
  reviewedAt?:      Date;
  // WHT config (set after KYC approved)
  whtExempt:        boolean;
  whtRate:          number;   // override per-tenant (default from platform config)
  createdAt:        Date;
  updatedAt:        Date;
}

const KycSchema = new Schema<IKycSubmission>(
  {
    tenantId:       { type: String, required: true, index: true },
    legalName:      { type: String, required: true, trim: true },
    taxId:          { type: String, required: true, trim: true },
    vatRegistered:  { type: Boolean, default: false },
    address:        { type: String, required: true },
    province:       { type: String, required: true },
    postalCode:     { type: String, required: true },
    contactName:    { type: String, required: true },
    contactPhone:   { type: String, required: true },
    docBusinessCert:   { type: String },
    docVatCert:        { type: String },
    docSignedContract: { type: String },
    status:         { type: String, enum: ["pending","approved","rejected","more_info_needed"], default: "pending" },
    reviewNote:     { type: String },
    reviewedBy:     { type: String },
    reviewedAt:     { type: Date },
    whtExempt:      { type: Boolean, default: false },
    whtRate:        { type: Number, default: 0.03 },
  },
  { timestamps: true }
);

export const KycSubmissionModel: Model<IKycSubmission> =
  mongoose.models.KycSubmission ??
  mongoose.model<IKycSubmission>("KycSubmission", KycSchema);
