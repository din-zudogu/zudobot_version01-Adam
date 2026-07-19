import mongoose, { Schema, Document } from "mongoose";

export interface IPartnerClientData extends Document {
  partnerId:  string; // strict isolation — only this partner can read/write
  tenantId?:  string; // optional link to provisioned User._id

  entityType: "individual" | "corporate";

  // ── Individual ──────────────────────────────────────────────────────────────
  fullName?:       string;
  nationalIdEnc?:  string; // AES-256-GCM encrypted
  passportEnc?:    string; // encrypted (alternative to national ID)
  addressBilling?: string;
  phoneEnc?:       string; // encrypted
  emailEnc?:       string; // encrypted

  // ── Corporate ───────────────────────────────────────────────────────────────
  corporateName?:  string;
  taxIdEnc?:       string; // encrypted
  addressOffice?:  string;
  branchCode?:     string;
  contactPerson?:  string;
  // phoneEnc + emailEnc shared with individual fields above

  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IPartnerClientData>(
  {
    partnerId:      { type: String, required: true, index: true },
    tenantId:       { type: String, index: true, sparse: true },
    entityType:     { type: String, enum: ["individual", "corporate"], required: true },

    fullName:       String,
    nationalIdEnc:  String,
    passportEnc:    String,
    addressBilling: String,
    phoneEnc:       String,
    emailEnc:       String,

    corporateName:  String,
    taxIdEnc:       String,
    addressOffice:  String,
    branchCode:     String,
    contactPerson:  String,
  },
  { timestamps: true }
);

export const PartnerClientDataModel =
  (mongoose.models.PartnerClientData as mongoose.Model<IPartnerClientData>) ??
  mongoose.model<IPartnerClientData>("PartnerClientData", schema);
