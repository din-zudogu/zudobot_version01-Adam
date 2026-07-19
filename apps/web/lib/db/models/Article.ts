import mongoose, { Schema, Document, Model } from "mongoose";

export interface IArticle extends Document {
  title:         string;
  slug:          string;
  excerpt:       string;
  content:       string;
  category:      string;
  thumbnail:     string | null;
  status:        "draft" | "published";
  readTimeLabel: string;
  publishedAt:   Date | null;
  createdBy:     string;
  channels:      string[];   // e.g. ["www.zudogu.com/trends", "www.zudobot.zudogu.com"]; empty = all channels
  createdAt:     Date;
  updatedAt:     Date;
}

const ArticleSchema = new Schema<IArticle>(
  {
    title:         { type: String, required: true, trim: true },
    slug:          { type: String, required: true, unique: true, trim: true },
    excerpt:       { type: String, required: true, trim: true },
    content:       { type: String, default: "" },
    category:      { type: String, required: true, trim: true },
    thumbnail:     { type: String, default: null },
    status:        { type: String, enum: ["draft", "published"], default: "draft" },
    readTimeLabel: { type: String, default: "อ่าน" },
    publishedAt:   { type: Date, default: null },
    createdBy:     { type: String, required: true },
    channels:      { type: [String], default: [] },
  },
  { timestamps: true }
);

ArticleSchema.index({ status: 1, publishedAt: -1 });
ArticleSchema.index({ status: 1, channels: 1, publishedAt: -1 });

export const ArticleModel: Model<IArticle> =
  mongoose.models.Article ??
  mongoose.model<IArticle>("Article", ArticleSchema);
