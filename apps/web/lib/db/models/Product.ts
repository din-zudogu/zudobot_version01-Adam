/**
 * Product — lightweight read-only reference to the shared Product collection
 * (same MongoDB DB as apps/api). Used by widget/chat to return product cards.
 */
import mongoose, { Schema, Document, Model } from "mongoose";

export interface IProduct extends Document {
  tenantId:         string;
  name:             string;
  price:            number;
  priceSuffix:      string;
  shortDescription: string;
  slug:             string;
  stock:            number | null;
  imageUrl?:          string;
  productUrl?:        string;
  stripePaymentLink?: string;
  isActive:           boolean;
}

const ProductSchema = new Schema<IProduct>(
  {
    tenantId:         { type: String, required: true },
    name:             { type: String, required: true },
    price:            { type: Number, default: 0 },
    priceSuffix:      { type: String, default: "" },
    shortDescription: { type: String, default: "" },
    slug:             { type: String, default: "" },
    stock:            { type: Number, default: null },
    imageUrl:          { type: String },
    productUrl:        { type: String },
    stripePaymentLink: { type: String },
    isActive:          { type: Boolean, default: true },
  },
  { timestamps: true }
);

ProductSchema.index({ tenantId: 1, isActive: 1 });
ProductSchema.index({ name: "text", shortDescription: "text" });

export const ProductModel: Model<IProduct> =
  mongoose.models.Product ??
  mongoose.model<IProduct>("Product", ProductSchema);
