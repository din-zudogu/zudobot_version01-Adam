import mongoose, { Schema, Document } from "mongoose";

export type PackageType = "BASE_PLAN" | "ADDON_MESSAGES" | "ADDON_MEMORY";

export interface IPackageConfig extends Document {
  slug: string;              // "trial", "starter_monthly", "addon_msg_1000"
  packageType: PackageType;
  name: string;
  description: string;
  price: number;             // THB, 0 = free
  messageQuota: number;      // messages per billing cycle (0 = not applicable)
  visitorMemoryQuota: number;// number of visitors that can be remembered (0 = not applicable)
  billingCycle: "monthly" | "one_time";
  isActive: boolean;
  sortOrder: number;
}

const packageConfigSchema = new Schema<IPackageConfig>(
  {
    slug:                 { type: String, required: true, unique: true, index: true },
    packageType:          { type: String, enum: ["BASE_PLAN","ADDON_MESSAGES","ADDON_MEMORY"], required: true },
    name:                 { type: String, required: true },
    description:          { type: String, default: "" },
    price:                { type: Number, required: true, min: 0 },
    messageQuota:         { type: Number, default: 0, min: 0 },
    visitorMemoryQuota:   { type: Number, default: 0, min: 0 },
    billingCycle:         { type: String, enum: ["monthly","one_time"], default: "monthly" },
    isActive:             { type: Boolean, default: true },
    sortOrder:            { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.models.PackageConfig as mongoose.Model<IPackageConfig> ||
  mongoose.model<IPackageConfig>("PackageConfig", packageConfigSchema);
