/**
 * CustomerMemory — cross-session memory indexed by hashed email.
 *
 * Email is NEVER stored in plaintext. The emailHash is a SHA-256 digest
 * of the lowercase-trimmed email, making it one-way and PDPA/GDPR compliant.
 *
 * A record is only created after the user gives explicit consent.
 * TTL auto-deletes records after expiresAt (default: 90 days, overridable
 * by tenant's Expired Add-on plan setting).
 */
import mongoose, { Schema, Document, Model } from "mongoose";

export interface ICustomerMemory extends Document {
  /** FK — which tenant this memory belongs to */
  tenantId: string;
  /** SHA-256 hash of lowercase-trimmed email — used as lookup key */
  emailHash: string;
  /** Topics and context discussed (no PII allowed) */
  topics: string[];
  /** Free-form AI-generated summary of key facts (no PII) */
  memorySummary?: string;
  /** ISO timestamp of last interaction */
  lastSeenAt: Date;
  /** TTL — MongoDB auto-deletes after this date */
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerMemorySchema = new Schema<ICustomerMemory>(
  {
    tenantId:      { type: String, required: true, index: true },
    emailHash:     { type: String, required: true },
    topics:        { type: [String], default: [] },
    memorySummary: { type: String },
    lastSeenAt:    { type: Date, default: () => new Date() },
    expiresAt:     { type: Date, required: true },
  },
  { timestamps: true },
);

// Compound unique index — one memory record per (tenant, customer)
CustomerMemorySchema.index({ tenantId: 1, emailHash: 1 }, { unique: true });

// MongoDB TTL auto-delete when expiresAt is reached (max 60s lag)
CustomerMemorySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const CustomerMemoryModel: Model<ICustomerMemory> =
  mongoose.models.CustomerMemory ??
  mongoose.model<ICustomerMemory>("CustomerMemory", CustomerMemorySchema);
