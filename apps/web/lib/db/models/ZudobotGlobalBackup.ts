/**
 * @file ZudobotGlobalBackup.ts
 * @description โมเดล Mongoose สำหรับเก็บข้อมูลสำรองแบบถาวร (Zero-deletion Lifecycle)
 * ข้อมูลจะไม่มีวันถูกลบอัตโนมัติ — ลบได้เฉพาะคำสั่ง Admin โดยตรง
 */

import mongoose, { Schema, Document, Model } from "mongoose";

export interface IZudobotGlobalBackup extends Document {
  originalLogId: string;
  tenantId: string;
  sessionId: string;
  role: "user" | "model" | "admin";
  message: string;
  tenantCreatedAt: Date;
  backedUpAt: Date;
  isProtected: boolean;
}

const ZudobotGlobalBackupSchema = new Schema<IZudobotGlobalBackup>(
  {
    originalLogId:   { type: String, required: true, unique: true },
    tenantId:        { type: String, required: true, index: true },
    sessionId:       { type: String, required: true, index: true },
    role:            { type: String, required: true },
    message:         { type: String, required: true },
    tenantCreatedAt: { type: Date, required: true },
    backedUpAt:      { type: Date, default: () => new Date(), index: true },
    isProtected:     { type: Boolean, default: true },
  },
  { timestamps: false },
);

export const ZudobotGlobalBackupModel: Model<IZudobotGlobalBackup> =
  mongoose.models.ZudobotGlobalBackup ??
  mongoose.model<IZudobotGlobalBackup>("ZudobotGlobalBackup", ZudobotGlobalBackupSchema);
