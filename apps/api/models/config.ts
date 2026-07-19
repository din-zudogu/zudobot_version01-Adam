import mongoose, { Schema, Document } from "mongoose";

export interface IConfig extends Document {
  tenantId: mongoose.Types.ObjectId;
  key: string; // e.g., "max_product_recommendations", "alert_cooldown_minutes"
  value: any; // Can be string, number, boolean, object
  type: "string" | "number" | "boolean" | "object";
  description?: string;
  updatedBy?: string;
  updatedAt: Date;
}

const configSchema = new Schema<IConfig>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    key: { type: String, required: true, index: true },
    value: { type: Schema.Types.Mixed, required: true },
    type: { type: String, enum: ["string", "number", "boolean", "object"], required: true },
    description: { type: String },
    updatedBy: { type: String },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Compound index for tenant + key uniqueness
configSchema.index({ tenantId: 1, key: 1 }, { unique: true });

export default mongoose.models.Config as mongoose.Model<IConfig> ||
  mongoose.model<IConfig>("Config", configSchema);