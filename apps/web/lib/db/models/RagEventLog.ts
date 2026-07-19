import mongoose, { Schema, Document, Model } from "mongoose";

export type RagMethod = "atlas" | "js_fallback" | "miss";

export interface IRagEventLog extends Document {
  tenantId:     string;
  sessionId:    string;
  querySnippet: string;   // first 80 chars of user message (no PII)
  method:       RagMethod;
  hitsCount:    number;
  topScore:     number;   // 0.0 if miss
  avgScore:     number;   // 0.0 if miss
  durationMs:   number;
  createdAt:    Date;     // TTL: auto-delete after 30 days
}

const RagEventLogSchema = new Schema<IRagEventLog>(
  {
    tenantId:     { type: String, required: true, index: true },
    sessionId:    { type: String, required: true },
    querySnippet: { type: String, default: "" },
    method:       { type: String, enum: ["atlas", "js_fallback", "miss"], required: true },
    hitsCount:    { type: Number, default: 0 },
    topScore:     { type: Number, default: 0 },
    avgScore:     { type: Number, default: 0 },
    durationMs:   { type: Number, default: 0 },
    createdAt:    { type: Date,   default: Date.now },
  },
  { timestamps: false },
);

// Auto-delete documents older than 30 days
RagEventLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });
RagEventLogSchema.index({ tenantId: 1, createdAt: -1 });
RagEventLogSchema.index({ method: 1, createdAt: -1 });

export const RagEventLogModel: Model<IRagEventLog> =
  mongoose.models.RagEventLog ??
  mongoose.model<IRagEventLog>("RagEventLog", RagEventLogSchema);
