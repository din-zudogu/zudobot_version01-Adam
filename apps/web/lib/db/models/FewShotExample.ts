import mongoose, { Schema, Document, Model } from "mongoose";

export interface IFewShotExample extends Document {
  userMessage:      string;
  botResponse:      string;
  /** Source tenant. "global" = extracted from aggregate across all tenants. */
  tenantId:         string;
  /** When true, usable as a generic example for all tenants. */
  isGlobal:         boolean;
  /** Number of user messages that followed after this pair in the session.
   *  Higher = stronger engagement signal = better example quality. */
  engagementScore:  number;
  extractedAt:      Date;  // TTL: auto-delete after 90 days
}

const FewShotExampleSchema = new Schema<IFewShotExample>(
  {
    userMessage:     { type: String, required: true },
    botResponse:     { type: String, required: true },
    tenantId:        { type: String, required: true, default: "global" },
    isGlobal:        { type: Boolean, default: true },
    engagementScore: { type: Number, default: 0 },
    extractedAt:     { type: Date, default: Date.now },
  },
  { timestamps: false },
);

// Auto-delete after 90 days so examples stay fresh
FewShotExampleSchema.index({ extractedAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });
FewShotExampleSchema.index({ isGlobal: 1, engagementScore: -1 });
FewShotExampleSchema.index({ tenantId: 1, engagementScore: -1 });

export const FewShotExampleModel: Model<IFewShotExample> =
  mongoose.models.FewShotExample ??
  mongoose.model<IFewShotExample>("FewShotExample", FewShotExampleSchema);
