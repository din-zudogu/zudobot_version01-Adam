/**
 * Config — per-tenant dynamic key-value configuration store.
 * Mirrors the Config model in apps/api for web-app queries.
 */
import mongoose, { Schema, Document, Model } from "mongoose";

export interface IConfig extends Document {
  tenantId:  string;
  key:       string;
  value:     string | number | boolean | Record<string, unknown>;
  valueType: "string" | "number" | "boolean" | "object";
  updatedBy?: string;
  updatedAt:  Date;
}

const ConfigSchema = new Schema<IConfig>(
  {
    tenantId:  { type: String, required: true },
    key:       { type: String, required: true },
    value:     { type: Schema.Types.Mixed, required: true },
    valueType: { type: String, enum: ["string", "number", "boolean", "object"], default: "string" },
    updatedBy: { type: String },
  },
  { timestamps: { createdAt: false, updatedAt: true } }
);

ConfigSchema.index({ tenantId: 1, key: 1 }, { unique: true });

export const ConfigModel: Model<IConfig> =
  mongoose.models.Config ??
  mongoose.model<IConfig>("Config", ConfigSchema);
