import mongoose, { Schema, Document, Model } from "mongoose";

export type UserRole = "super_admin" | "admin" | "tenant" | "partner_admin";
export type BotState =
  | "trial"
  | "trial_quota_daily_exhausted"
  | "trial_expired"
  | "active"
  | "grace_5pct"
  | "suspended_quota"
  | "suspended_payment"
  | "pending_kyc"
  | "disabled";

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  email: string;
  name: string;
  passwordHash?: string;
  passwordResetTokenHash?: string;
  passwordResetExpiresAt?: Date;
  googleId?: string;
  role: UserRole;
  roles: UserRole[];
  tenantId?: string;
  botState?: BotState;
  trialEndsAt?: Date;
  emailVerified?: Date;
  image?: string;
  onboardingComplete: boolean;
  pdpaConsentAt?: Date;
  // Two-Factor Authentication (TOTP)
  twoFactorEnabled:  boolean;
  twoFactorSecret?:  string;   // base32 TOTP secret (store encrypted in prod)
  twoFactorVerified: boolean;  // true once user has confirmed setup
  // VIP status (set by srv_vip_sync when a matching VipTenant record is active)
  isVip: boolean;
  vipExpiresAt?: Date;
  // Soft-delete / account closure
  pendingDeleteAt?: Date;      // when set, account is queued for hard-delete on this date
  deletedByAdmin?:  boolean;   // true = admin-initiated soft delete; tenant cannot self-recover
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name:  { type: String, required: true, trim: true },
    passwordHash: { type: String },
    passwordResetTokenHash: { type: String },
    passwordResetExpiresAt: { type: Date },
    googleId:     { type: String },
    role:  { type: String, enum: ["super_admin","admin","tenant","partner_admin"], default: "tenant" },
    roles: { type: [String], default: [] },
    tenantId: { type: String },
    botState: {
      type: String,
      enum: [
        "trial","trial_quota_daily_exhausted","trial_expired",
        "active","grace_5pct","suspended_quota","suspended_payment",
        "pending_kyc","disabled",
      ],
      default: "trial",
    },
    trialEndsAt:        { type: Date },
    emailVerified:      { type: Date },
    image:              { type: String },
    onboardingComplete: { type: Boolean, default: false },
    pdpaConsentAt:      { type: Date },
    twoFactorEnabled:   { type: Boolean, default: false },
    twoFactorSecret:    { type: String },
    twoFactorVerified:  { type: Boolean, default: false },
    isVip:              { type: Boolean, default: false },
    vipExpiresAt:       { type: Date },
    pendingDeleteAt:    { type: Date },
    deletedByAdmin:     { type: Boolean },
  },
  { timestamps: true }
);

// email index is implicit from unique:true; add explicit indexes for other lookups
UserSchema.index({ tenantId: 1 }, { sparse: true });
UserSchema.index({ googleId: 1 }, { sparse: true });

export const UserModel: Model<IUser> =
  mongoose.models.User ?? mongoose.model<IUser>("User", UserSchema);
