import mongoose, { Schema, Document, Model } from "mongoose";

/** Snapshot ของ 1 CostPriceScenario ที่เลือกเข้าแพคเกจสำเร็จรูป */
export interface IReadyPackageItem {
  scenarioId: mongoose.Types.ObjectId;
  plan: string;
  packageName: string;
  // ── ราคาและภาษี ──────────────────────────────────────────────────
  bestPriceZudobot: number;
  bestPricePartner: number;
  vat7Zudobot: number;
  wht3Zudobot: number;
  vat7Partner: number;
  wht3Partner: number;
  /** ต้นทุนจริง (AR = ROUNDUP(AS)) จาก scenario.calculated — ใช้คำนวณ % กำไรจริง */
  totalCostAr?: number;
  // ── Spec snapshot (สำหรับแสดงคำอธิบายในตาราง ไม่ต้อง join) ──────
  messageCount?: number;
  tokensPerMessage?: number;
  historyTokenCount?: number;
  storageMbPerSentence?: number;
  storageExpireDays?: number;
  trialDurationDays?: number;
}

export interface IReadyPackage extends Document {
  /** ชื่อแพคเกจสำเร็จรูปที่แสดงต่อสาธารณะ */
  name: string;
  /** รายการ Plan/Package ที่รวมอยู่ในแพคเกจนี้ */
  items: IReadyPackageItem[];
  /**
   * ราคาขายสุดท้าย Retail (admin-set)
   * ถ้าไม่ได้ตั้ง → ใช้ auto = ROUNDUP(Σ(bestPriceZudobot+wht3), 100)
   */
  finalRetailPrice?: number;
  /**
   * ราคาขายสุดท้าย Partner (admin-set)
   * ถ้าไม่ได้ตั้ง → ใช้ auto = CLAMP(finalRetail×0.65, costPartner×1.01, finalRetail×0.60)
   */
  finalPartnerPrice?: number;
  /** ใช้งาน / ไม่ใช้งาน */
  isActive: boolean;
  /** เปิดขาย / ไม่เปิดขาย */
  isOnSale: boolean;
  /** แพคเกจทดลองใช้ */
  isTrial: boolean;
  /** จำนวนวันทดลองใช้ (เมื่อ isTrial=true) */
  trialDays?: number;
  /** อนุญาตให้ Partner ขายได้หรือไม่ */
  isPartnerAllowed: boolean;
  /**
   * โควต้าจำนวนร้านค้าที่ใช้แพคเกจนี้ได้
   * 0 หรือ undefined = ไม่จำกัด (unlimited)
   * นโยบาย "ใช้แล้วใช้เลย" — ร้านที่เคยรับแพคเกจถูกนับถาวร ไม่คืนสิทธิ์เมื่อยกเลิก
   */
  maxShops?: number;
  /**
   * (optional) จำกัดเฉพาะร้านค้าใหม่ (สมัครใหม่ / ยังไม่เคยชำระเงิน) เท่านั้น
   * true = ร้านเดิมที่เคยเป็นลูกค้าชำระเงินแล้วจะรับแพคเกจนี้ไม่ได้
   */
  newShopsOnly?: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

const ReadyPackageItemSchema = new Schema<IReadyPackageItem>(
  {
    scenarioId:         { type: Schema.Types.ObjectId, ref: "CostPriceScenario", required: true },
    plan:               { type: String, required: true },
    packageName:        { type: String, default: "" },
    bestPriceZudobot:   { type: Number, default: 0 },
    bestPricePartner:   { type: Number, default: 0 },
    vat7Zudobot:        { type: Number, default: 0 },
    wht3Zudobot:        { type: Number, default: 0 },
    vat7Partner:        { type: Number, default: 0 },
    wht3Partner:        { type: Number, default: 0 },
    totalCostAr:        { type: Number },
    // spec snapshot
    messageCount:       { type: Number },
    tokensPerMessage:   { type: Number },
    historyTokenCount:  { type: Number },
    storageMbPerSentence: { type: Number },
    storageExpireDays:  { type: Number },
    trialDurationDays:  { type: Number },
  },
  { _id: false },
);

const ReadyPackageSchema = new Schema<IReadyPackage>(
  {
    name:              { type: String, required: true, trim: true },
    items:             { type: [ReadyPackageItemSchema], required: true, validate: (v: unknown[]) => v.length > 0 },
    finalRetailPrice:  { type: Number },
    finalPartnerPrice: { type: Number },
    isActive:          { type: Boolean, default: true },
    isOnSale:          { type: Boolean, default: false },
    isTrial:           { type: Boolean, default: false },
    trialDays:         { type: Number },
    isPartnerAllowed:  { type: Boolean, default: true },
    maxShops:          { type: Number, default: 0, min: 0 },
    newShopsOnly:      { type: Boolean, default: false },
    sortOrder:         { type: Number, default: 0 },
  },
  { timestamps: true },
);

ReadyPackageSchema.index({ "items.scenarioId": 1 });
ReadyPackageSchema.index({ isActive: 1, isOnSale: 1 });

export const ReadyPackageModel: Model<IReadyPackage> =
  mongoose.models.ReadyPackage ??
  mongoose.model<IReadyPackage>("ReadyPackage", ReadyPackageSchema);
