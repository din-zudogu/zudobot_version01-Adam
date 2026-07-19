import mongoose, { Document, Model, Schema } from "mongoose";

export interface IZudobotConfig extends Document {
  tenantId: string;
  botName: string;
  welcomeMessage: string;
  themeColor: string;
  whitelistedDomains: string[];
  updatedAt: Date;
}

const ZudobotConfigSchema = new Schema<IZudobotConfig>(
  {
    tenantId: { type: String, required: true, unique: true, index: true },
    botName: { type: String, default: "Zudobot" },
    welcomeMessage: { type: String, default: "สวัสดีครับ มีอะไรให้ผมช่วยไหมครับ" },
    themeColor: { type: String, default: "#3B82F6" },
    whitelistedDomains: { type: [String], default: [], index: true },
  },
  { timestamps: true }
);

ZudobotConfigSchema.index({ tenantId: 1, whitelistedDomains: 1 });

export const ZudobotConfig: Model<IZudobotConfig> =
  mongoose.models.ZudobotConfig ??
  mongoose.model<IZudobotConfig>("ZudobotConfig", ZudobotConfigSchema);
