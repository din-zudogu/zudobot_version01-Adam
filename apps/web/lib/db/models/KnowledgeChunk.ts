import mongoose, { Schema, Document } from "mongoose";

export interface IKnowledgeChunk extends Document {
  tenantId:   string;
  sourceUrl:  string;
  content:    string;
  embedding:  number[];
  chunkIndex: number;
  scrapedAt:  Date;
}

const KnowledgeChunkSchema = new Schema<IKnowledgeChunk>({
  tenantId:   { type: String, required: true, index: true },
  sourceUrl:  { type: String, required: true },
  content:    { type: String, required: true },
  embedding:  { type: [Number], required: true },
  chunkIndex: { type: Number, required: true },
  scrapedAt:  { type: Date, default: () => new Date() },
}, { timestamps: false });

KnowledgeChunkSchema.index({ tenantId: 1, sourceUrl: 1 });

export const KnowledgeChunkModel =
  (mongoose.models.KnowledgeChunk as mongoose.Model<IKnowledgeChunk>) ||
  mongoose.model<IKnowledgeChunk>("KnowledgeChunk", KnowledgeChunkSchema, "knowledgechunks");
