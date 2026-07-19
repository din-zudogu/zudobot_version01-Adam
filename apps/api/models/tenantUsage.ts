import mongoose, { Schema, Document } from "mongoose";

interface AddonEntry {
  packageId: mongoose.Types.ObjectId;
  packageSlug: string;
  purchasedAt: Date;
  expiresAt: Date | null;
  quotaGranted: number;  // messages or visitors added by this addon
}

export interface ITenantUsage extends Document {
  tenantId: mongoose.Types.ObjectId;
  activePackageSlug: string;         // ref to PackageConfig.slug
  addons: AddonEntry[];
  // Message quota
  totalMessageQuota: number;         // base + all active addon messages
  usedMessages: number;
  // Memory quota
  totalVisitorMemoryQuota: number;   // base + all active addon memory
  usedVisitorMemory: number;
  isMemoryFull: boolean;
  // Billing cycle
  cycleStartDate: Date;
  cycleEndDate: Date;
  lastResetAt: Date;
}

const addonEntrySchema = new Schema<AddonEntry>(
  {
    packageId:    { type: Schema.Types.ObjectId, required: true },
    packageSlug:  { type: String, required: true },
    purchasedAt:  { type: Date, required: true },
    expiresAt:    { type: Date, default: null },
    quotaGranted: { type: Number, required: true },
  },
  { _id: false }
);

const tenantUsageSchema = new Schema<ITenantUsage>(
  {
    tenantId:                 { type: Schema.Types.ObjectId, ref: "Tenant", required: true, unique: true, index: true },
    activePackageSlug:        { type: String, default: "trial" },
    addons:                   { type: [addonEntrySchema], default: [] },
    totalMessageQuota:        { type: Number, default: 100 },
    usedMessages:             { type: Number, default: 0, min: 0 },
    totalVisitorMemoryQuota:  { type: Number, default: 0 },
    usedVisitorMemory:        { type: Number, default: 0, min: 0 },
    isMemoryFull:             { type: Boolean, default: false },
    cycleStartDate:           { type: Date, default: Date.now },
    cycleEndDate:             { type: Date, default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
    lastResetAt:              { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.models.TenantUsage as mongoose.Model<ITenantUsage> ||
  mongoose.model<ITenantUsage>("TenantUsage", tenantUsageSchema);
