import mongoose, { Schema, Document, Model } from "mongoose";

export type LockReason = "auth_failure_threshold" | "export_abuse" | "manual";

export interface ISecurityState extends Document {
  key: string;
  isLocked: boolean;
  lockedAt?: Date;
  lockReason?: LockReason;
  // Rolling window counters (reset when window expires)
  failedAuthCount: number;
  failedAuthWindowStart?: Date;
  exportCount: number;
  exportWindowStart?: Date;
  // Unlock-attempt rate limiting
  unlockAttemptCount: number;
  unlockAttemptWindowStart?: Date;
  totalLockCount: number;
  lastUnlockedAt?: Date;
}

const SecurityStateSchema = new Schema<ISecurityState>(
  {
    key:                    { type: String, required: true, unique: true },
    isLocked:               { type: Boolean, default: false },
    lockedAt:               { type: Date },
    lockReason:             { type: String },
    failedAuthCount:        { type: Number, default: 0 },
    failedAuthWindowStart:  { type: Date },
    exportCount:            { type: Number, default: 0 },
    exportWindowStart:      { type: Date },
    unlockAttemptCount:     { type: Number, default: 0 },
    unlockAttemptWindowStart: { type: Date },
    totalLockCount:         { type: Number, default: 0 },
    lastUnlockedAt:         { type: Date },
  },
  { timestamps: true }
);

export const SecurityStateModel: Model<ISecurityState> =
  mongoose.models.SecurityState ??
  mongoose.model<ISecurityState>("SecurityState", SecurityStateSchema);
