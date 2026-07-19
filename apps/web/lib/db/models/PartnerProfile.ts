/**
 * PartnerProfile — PARTNER SYSTEM
 *
 * One document per Partner (Software House / Freelancer).
 * Linked 1-to-1 with User(role='partner_admin') via userId.
 *
 * Financial flow:
 *   Customer pays endUserPrice → Partner's Stripe account
 *   Zudobot auto-deducts partnerCost (application_fee) → Zudobot's Stripe
 *   Partner keeps: endUserPrice - partnerCost - Stripe fee (~3.4% + ฿10)
 */

import mongoose, { Schema, Document, Model } from "mongoose";
import crypto from "crypto";

export type PartnerStatus = "invited" | "active" | "suspended";

export interface IPartnerProfile extends Document {
  // Identity — linked to User._id
  userId:      string;
  companyName: string;
  email:       string;         // same as User.email (denormalized for quick lookup)
  phone?:      string;

  // Lifecycle
  status:          PartnerStatus;
  inviteToken?:    string;     // one-time token sent via invite email; cleared on join
  inviteExpiresAt?: Date;
  inviteEmail:     string;     // email the invite was sent to (may differ from registered email)

  // Verification (partner/verify flow)
  verifyCode?:          string;   // 6-digit OTP
  verifyCodeExpiresAt?: Date;
  verifyAttempts:       number;   // wrong-code attempts since last reset
  verifyLockedAt?:      Date;     // set when verifyAttempts >= 5

  // Admin-initiated soft delete (90-day pending window, blocks dashboard)
  pendingDeleteAt?: Date;  // set by admin soft_delete; cron hard-deletes when elapsed

  // Soft-delete — set when admin deletes; hard-deleted by dailyCheck after 90 days
  deletedAt?: Date;

  // Stripe Connect — Partner is Merchant of Record
  stripeConnectAccountId?: string;  // acct_xxxxxxxxxxxxxxxx
  isStripeConnected:       boolean;

  // Cached stats (updated by cron / on each webhook event)
  totalActiveSlots:  number;
  totalEarningsThb:  number;

  createdAt: Date;
  updatedAt: Date;
}

const PartnerProfileSchema = new Schema<IPartnerProfile>(
  {
    userId:      { type: String, required: true, unique: true, index: true },
    companyName: { type: String, required: true, trim: true },
    email:       { type: String, required: true, lowercase: true, trim: true },
    phone:       { type: String },

    status:           { type: String, enum: ["invited","active","suspended"], default: "invited" },
    inviteToken:      { type: String, index: true, sparse: true },
    inviteExpiresAt:  { type: Date },
    inviteEmail:      { type: String, required: true, lowercase: true },

    verifyCode:          { type: String },
    verifyCodeExpiresAt: { type: Date },
    verifyAttempts:      { type: Number, default: 0 },
    verifyLockedAt:      { type: Date, index: true, sparse: true },

    pendingDeleteAt: { type: Date, index: true, sparse: true },
    deletedAt:       { type: Date, index: true, sparse: true },

    stripeConnectAccountId: { type: String },
    isStripeConnected:      { type: Boolean, default: false },

    totalActiveSlots:  { type: Number, default: 0 },
    totalEarningsThb:  { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const PartnerProfileModel: Model<IPartnerProfile> =
  mongoose.models.PartnerProfile ??
  mongoose.model<IPartnerProfile>("PartnerProfile", PartnerProfileSchema);

// ── Helpers ────────────────────────────────────────────────────────────────

export function generateInviteToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function generateVerifyCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function inviteUrl(token: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://zudobot.zudogu.com";
  return `${base}/partner/join?token=${token}`;
}

export function verifyUrl(token: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://zudobot.zudogu.com";
  return `${base}/partner/verify?token=${token}`;
}
