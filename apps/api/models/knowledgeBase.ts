import mongoose, { Schema, Document } from "mongoose";

export interface IKnowledgeBase extends Document {
  tenantId: mongoose.Types.ObjectId;
  type: "text" | "url" | "pdf";
  title: string;
  content: string;
  sourceUrl: string | null;
  embedding: number[];
  embeddingUpdatedAt: Date | null;
  isActive: boolean;
}

const knowledgeBaseSchema = new Schema<IKnowledgeBase>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true, index: true },
    type: { type: String, enum: ["text", "url", "pdf"], default: "text" },
    title: { type: String, required: true, maxlength: 200 },
    content: { type: String, required: true, maxlength: 20000 },
    sourceUrl: { type: String, default: null },
    embedding: { type: [Number], default: [] },
    embeddingUpdatedAt: { type: Date, default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.models.KnowledgeBase as mongoose.Model<IKnowledgeBase> ||
  mongoose.model<IKnowledgeBase>("KnowledgeBase", knowledgeBaseSchema);
