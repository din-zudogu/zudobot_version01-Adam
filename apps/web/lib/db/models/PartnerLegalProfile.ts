import mongoose, { Schema, Document } from "mongoose";

export interface IPartnerLegalProfile extends Document {
  partnerId:   string; // PartnerProfile._id

  entityType:  "individual" | "corporate";

  // ── Individual fields ──────────────────────────────────────────────────────
  fullNameInd?:        string;
  nationalIdEnc?:      string; // AES-256-GCM encrypted
  addressResidence?:   string;
  bankAccIndEnc?:      string; // encrypted

  // ── Corporate fields ───────────────────────────────────────────────────────
  corporateName?:      string;
  taxIdEnc?:           string; // encrypted
  addressOffice?:      string;
  branchCode?:         string;
  authorizedSignatory?: string;
  bankAccCorpEnc?:     string; // encrypted

  // ── Docs (Supabase / S3 URLs stored as plain strings — not sensitive PII) ─
  documentUrls:        string[];

  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IPartnerLegalProfile>(
  {
    partnerId:           { type: String, required: true, unique: true, index: true },
    entityType:          { type: String, enum: ["individual", "corporate"], required: true },

    fullNameInd:         String,
    nationalIdEnc:       String,
    addressResidence:    String,
    bankAccIndEnc:       String,

    corporateName:       String,
    taxIdEnc:            String,
    addressOffice:       String,
    branchCode:          String,
    authorizedSignatory: String,
    bankAccCorpEnc:      String,

    documentUrls: { type: [String], default: [] },
  },
  { timestamps: true }
);

export const PartnerLegalProfileModel =
  (mongoose.models.PartnerLegalProfile as mongoose.Model<IPartnerLegalProfile>) ??
  mongoose.model<IPartnerLegalProfile>("PartnerLegalProfile", schema);
