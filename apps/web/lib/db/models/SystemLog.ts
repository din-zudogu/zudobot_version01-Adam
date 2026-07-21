import mongoose, { Schema, Document, Model } from "mongoose";

export type SystemLogCategory = "auth" | "bot_state" | "admin_action" | "payment";

export interface ISystemLog extends Document {
  category:    SystemLogCategory;
  email?:      string;                  // account the event is ABOUT (lowercase)
  actorEmail?: string;                  // who DID it — set for admin_action only
  action:      string;
  details?:    Record<string, unknown>;
  ip?:         string;
  createdAt:   Date;                    // TTL: auto-delete after 1 year
}

const SystemLogSchema = new Schema<ISystemLog>(
  {
    category:    { type: String, enum: ["auth", "bot_state", "admin_action", "payment"], required: true },
    email:       { type: String, lowercase: true, trim: true },
    actorEmail:  { type: String, lowercase: true, trim: true },
    action:      { type: String, required: true },
    details:     { type: Schema.Types.Mixed },
    ip:          { type: String },
    createdAt:   { type: Date, default: Date.now },
  },
  { timestamps: false },
);

// Auto-delete documents older than 1 year — durable audit trail, not telemetry
SystemLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 365 });
SystemLogSchema.index({ email: 1, createdAt: -1 });
SystemLogSchema.index({ category: 1, createdAt: -1 });
SystemLogSchema.index({ actorEmail: 1, createdAt: -1 }, { sparse: true });

export const SystemLogModel: Model<ISystemLog> =
  mongoose.models.SystemLog ??
  mongoose.model<ISystemLog>("SystemLog", SystemLogSchema);
