import mongoose, { Schema, Document } from "mongoose";

// Logged when a user message returns no RAG product or knowledge base match —
// these are questions the bot can't answer well and should become new KB articles.
export interface IKnowledgeGap extends Document {
  tenantId: mongoose.Types.ObjectId;
  sessionId: string;
  query: string;     // trimmed to 300 chars
  frequency: number; // incremented when same normalized query appears again
  resolved: boolean; // merchant marks as resolved after adding to KB
  createdAt: Date;
  updatedAt: Date;
}

const knowledgeGapSchema = new Schema<IKnowledgeGap>(
  {
    tenantId:  { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    sessionId: { type: String, required: true },
    query:     { type: String, required: true, maxlength: 300 },
    frequency: { type: Number, default: 1 },
    resolved:  { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Deduplicate by tenant + normalized query text
knowledgeGapSchema.index({ tenantId: 1, query: 1 }, { unique: true });
knowledgeGapSchema.index({ tenantId: 1, frequency: -1 });
knowledgeGapSchema.index({ tenantId: 1, resolved: 1 });

export default mongoose.models.KnowledgeGap as mongoose.Model<IKnowledgeGap> ||
  mongoose.model<IKnowledgeGap>("KnowledgeGap", knowledgeGapSchema);
