import mongoose, { Schema, Document, Model } from "mongoose";
import type { PlatformSettings } from "@/types";

export interface IPlatformSettings extends PlatformSettings, Document {}

const PlatformSettingsSchema = new Schema<IPlatformSettings>(
  {
    // Group A — Trial
    trialDurationDays:               { type: Number,   default: 14 },
    trialDailyQuotaCap:              { type: Number,   default: 250 },
    trialQuotaExhaustedBotMessage:   { type: String,   default: "คุณใช้ครบโควต้าวันนี้แล้วค่ะ/ครับ กรุณาลองใหม่พรุ่งนี้ หรือสมัครแพ็กเกจเพื่อโควต้าเพิ่มเติม 🚀" },
    trialQuotaExhaustedEmailSubject: { type: String,   default: "Zudobot — โควต้าทดลองใช้วันนี้หมดแล้ว" },
    trialQuotaExhaustedEmailBody:    { type: String,   default: "สวัสดีค่ะ คุณใช้โควต้าทดลองครบ 250 ข้อความแล้ววันนี้ สมัครแพ็กเกจ Starter เพียง 490฿/เดือน เพื่อรับ 500 ข้อความ/วัน" },

    // Group B — Quota
    quotaAlertThresholds:            { type: [Number], default: [80, 95] },
    quotaGraceBufferPercent:         { type: Number,   default: 5 },
    quotaExhaustedBotMessage:        { type: String,   default: "บอทถูกระงับชั่วคราวเนื่องจากโควต้าเต็มค่ะ/ครับ กรุณาติดต่อผู้ดูแลระบบ" },

    // Group C — Payment Grace
    nonEnterpriseRenewalGraceDays:   { type: Number,   default: 7 },
    enterpriseInvoiceGraceDays:      { type: Number,   default: 30 },
    enterpriseBillingAlertDays:      { type: Number,   default: 7 },

    // Group D — Bot Behavior
    sessionTimeoutMinutes:           { type: Number,   default: 30 },
    minimumEngagementSeconds:        { type: Number,   default: 60 },
    amnesiaMessageTemplate:          { type: String,   default: "ขออภัยค่ะ/ครับ ฉันจำการสนทนาก่อนหน้าไม่ได้แล้ว ช่วยอธิบายใหม่ได้เลยนะคะ/ครับ" },
    retentionWarningDays:            { type: Number,   default: 7 },
    geminiDownMessage:               { type: String,   default: "ขออภัย ระบบ AI กำลังปรับปรุง กรุณาลองใหม่ในอีกสักครู่ค่ะ/ครับ" },

    // Group E — Centralized Data
    centralizedRetentionYears:       { type: Number,   default: 3 },
    centralizedCleanupDayOfMonth:    { type: Number,   default: 1 },

    // Group F — Sandbox
    sandboxRateLimitPerHour:         { type: Number,   default: 20 },
    sandboxAccountMessageLimit:      { type: Number,   default: 20 },
    sandboxCtaTriggerAfterMessages:  { type: Number,   default: 5 },
    sandboxCtaMessage:               { type: String,   default: "สนใจใช้งานจริงไหม? ทดลองฟรี 14 วัน ไม่ต้องใช้บัตรเครดิต 🚀" },

    // Group G — Financial
    vatRate:                         { type: Number,   default: 0.07 },
    enterpriseCostPlusMultiplier:    { type: Number,   default: 1.3 },
    whtRate:                         { type: Number,   default: 0.03 },

    // Group H — CDN & Widget
    widgetCdnBaseUrl:                { type: String,   default: "https://zudobot.zudogu.com" },
    widgetStableVersion:             { type: String,   default: "1.0.0" },
    widgetLatestVersion:             { type: String,   default: "1.0.0" },

    // Group I — Legal & Compliance
    privacyPolicyHtml:               { type: String,   default: "<p>นโยบายความเป็นส่วนตัว PDPA</p>" },
    privacyPolicyUrl:                { type: String,   default: "https://zudobot.zudogu.com/privacy" },
    widgetDisclaimerMessage:         { type: String,   default: "การสนทนานี้ขับเคลื่อนโดย AI ข้อมูลของคุณได้รับการคุ้มครองตาม PDPA" },
    pdpaContextLink:                 { type: String,   default: "https://zudobot.zudogu.com/privacy" },

    // Group J — Tax & Invoice
    invoiceSellerName:               { type: String,   default: "บริษัท ซูโดกุ จำกัด (Zudogu Co., Ltd.)" },
    invoiceSellerTaxId:              { type: String,   default: "0105567000000" },
    invoiceSellerAddress:            { type: String,   default: "123 ถนนสุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพมหานคร 10110" },
    invoiceSellerPhone:              { type: String,   default: "+66-2-000-0000" },
    invoiceSellerEmail:              { type: String,   default: "billing@zudogu.com" },
    invoiceSellerIsVatRegistered:    { type: Boolean,  default: true },
    invoiceNumberPrefix:             { type: String,   default: "ZUD" },
    invoiceDueDays:                  { type: Number,   default: 7 },
    invoiceWhtThreshold:             { type: Number,   default: 1000 },
    invoiceReceiptFooterNote:        { type: String,   default: "" },
    invoiceReceiptShowVat:           { type: Boolean,  default: true },
    invoiceReceiptShowWht:           { type: Boolean,  default: true },
  },
  { timestamps: true }
);

export const PlatformSettingsModel: Model<IPlatformSettings> =
  mongoose.models.PlatformSettings ??
  mongoose.model<IPlatformSettings>("PlatformSettings", PlatformSettingsSchema);

/** Fetch or create the singleton settings document */
export async function getPlatformSettings(): Promise<IPlatformSettings> {
  let settings = await PlatformSettingsModel.findOne();
  if (!settings) {
    settings = await PlatformSettingsModel.create({});
  }
  return settings;
}
