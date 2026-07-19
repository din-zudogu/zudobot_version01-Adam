import mongoose, { type Document, type Model } from "mongoose";

export interface IExchangeRateCache extends Document {
  base:      string;              // "THB"
  rates:     Record<string, number>; // { USD: 0.0295, JPY: 4.45, ... }
  fetchedAt: Date;
}

const schema = new mongoose.Schema<IExchangeRateCache>({
  base:      { type: String, required: true, unique: true, uppercase: true },
  rates:     { type: mongoose.Schema.Types.Mixed, required: true },
  fetchedAt: { type: Date, required: true },
});

export const ExchangeRateCacheModel: Model<IExchangeRateCache> =
  mongoose.models["ExchangeRateCache"] ??
  mongoose.model<IExchangeRateCache>("ExchangeRateCache", schema);
