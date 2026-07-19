import mongoose, { Schema, Document, Model } from "mongoose";

export type CustomPackageStatus = "draft" | "purchased";

export interface ICustomPackage extends Document {
  code:            string;   // ZCP-YYYYMMDD-XXXXXXXX (unique)
  name:            string;   // user-defined package name
  quotaAddonId:    string;   // key from QUOTA_ADDON_CATALOG
  memoryAddonId:   string;   // key from MEMORY_ADDON_CATALOG
  retentionAddonId: string;  // key from RETENTION_ADDON_CATALOG
  totalPrice:      number;   // total add-on price (THB, excl. VAT)
  tenantId?:       string;   // set when checkout completes
  status:          CustomPackageStatus;
  createdAt:       Date;
  updatedAt:       Date;
}

const CustomPackageSchema = new Schema<ICustomPackage>(
  {
    code:            { type: String, required: true, unique: true, index: true },
    name:            { type: String, required: true, trim: true, maxlength: 80 },
    quotaAddonId:    { type: String, required: true },
    memoryAddonId:   { type: String, required: true },
    retentionAddonId:{ type: String, required: true },
    totalPrice:      { type: Number, required: true, min: 0 },
    tenantId:        { type: String },
    status:          { type: String, enum: ["draft", "purchased"], default: "draft" },
  },
  { timestamps: true },
);

export const CustomPackageModel: Model<ICustomPackage> =
  mongoose.models.CustomPackage ??
  mongoose.model<ICustomPackage>("CustomPackage", CustomPackageSchema);
