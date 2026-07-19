import mongoose, { Schema, Document } from "mongoose";

export interface IProduct extends Document {
  tenantId:         mongoose.Types.ObjectId;
  name:             string;
  price:            number;    // -1 = "ติดต่อสอบถาม", 0 = free, >0 = price in THB
  priceSuffix:      string;    // e.g. "/เดือน", "/ชิ้น"
  shortDescription: string;
  slug:             string;
  stock:            number | null;  // null = unlimited
  variants:         string[];
  isActive:         boolean;
  embedding:        number[];       // 768-dim vector from text-embedding-004
  embeddedAt:       Date | null;
  createdAt:        Date;
  updatedAt:        Date;
}

const productSchema = new Schema<IProduct>(
  {
    tenantId: {
      type: Schema.Types.ObjectId, ref: "Tenant",
      required: true, index: true,
    },
    name:             { type: String, required: true, maxlength: 300 },
    price:            { type: Number, default: 0 },
    priceSuffix:      { type: String, default: "" },
    shortDescription: { type: String, default: "", maxlength: 2000 },
    slug:             { type: String, default: "" },
    stock:            { type: Number, default: null },
    variants:         { type: [String], default: [] },
    isActive:         { type: Boolean, default: true, index: true },
    embedding:        { type: [Number], default: [] },
    embeddedAt:       { type: Date, default: null },
  },
  { timestamps: true }
);

// Compound index for tenant queries + active filter
productSchema.index({ tenantId: 1, isActive: 1 });
// Text index for fallback keyword search
productSchema.index({ name: "text", shortDescription: "text" });

export default mongoose.models.Product as mongoose.Model<IProduct> ||
  mongoose.model<IProduct>("Product", productSchema);
