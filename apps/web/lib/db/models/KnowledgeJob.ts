import mongoose, { Schema, Document } from "mongoose";

export type JobStatus = "pending" | "processing" | "done" | "failed";

export interface IKnowledgeJob extends Document {
  tenantId:        string;
  sourceUrl:       string;
  rawText:         string;
  status:          JobStatus;
  totalChunks:     number;
  processedChunks: number;
  errorMsg?:       string;
  createdAt:       Date;
  updatedAt:       Date;
}

const KnowledgeJobSchema = new Schema<IKnowledgeJob>(
  {
    tenantId:        { type: String, required: true, index: true },
    sourceUrl:       { type: String, required: true },
    rawText:         { type: String, default: "" },
    status:          { type: String, enum: ["pending", "processing", "done", "failed"], default: "pending" },
    totalChunks:     { type: Number, default: 0 },
    processedChunks: { type: Number, default: 0 },
    errorMsg:        { type: String },
  },
  { timestamps: true },
);

KnowledgeJobSchema.index({ tenantId: 1, sourceUrl: 1 }, { unique: true });
KnowledgeJobSchema.index({ status: 1 });

export const KnowledgeJobModel =
  (mongoose.models.KnowledgeJob as mongoose.Model<IKnowledgeJob>) ||
  mongoose.model<IKnowledgeJob>("KnowledgeJob", KnowledgeJobSchema, "knowledgejobs");
