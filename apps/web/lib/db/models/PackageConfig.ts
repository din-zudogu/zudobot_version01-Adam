/**
 * PackageConfig — admin-editable plan catalog.
 *
 * Overrides PLAN_CATALOG defaults from pmRules.ts.
 * Admin can enable/disable plans, set custom pricing, quota, and feature flags.
 */
import mongoose, { Schema, Document, Model } from "mongoose";

export type PackageType = "base" | "memory_addon" | "quota_addon" | "retention_addon";

export interface IPackageConfig extends Document {
  packageId:        string;   // e.g. "starter", "pro", "quota_1k", "ret_30d"
  packageType:      PackageType;
  label:            string;   // display name
  description:      string;
  // B2C retail price (end-user pays)
  priceThb:         number;
  // B2B wholesale price (partner's cost to Zudobot; partner earns retail - wholesale)
  wholesalePriceThb?: number;
  // Internal cost tracking
  systemCostThb?:   number;   // AI API + infra cost estimate
  stripeFeeThb?:    number;   // estimated Stripe transaction fee
  // Base plan quota fields
  msgPerDay?:       number;   // legacy daily quota (trial only)
  msgPerMonth?:     number;   // monthly message quota (-1 = unlimited)
  // Quota add-on
  extraMsgPerMonth?: number;  // additional messages per month (quota_addon type)
  // Memory add-on (legacy)
  memoryMb?:        number;
  // Retention
  retentionDays?:   number;   // -1 = lifetime
  // Feature limits
  maxSessionCrossSearch?: number;
  // Feature flags
  isActive:         boolean;
  isPopular:        boolean;
  isEnterprise:     boolean;
  sortOrder:        number;
  // Partner resale — wholesale cost Zudobot collects per billing cycle.
  // undefined = plan is NOT available for partner resale.
  partnerCost?:     number;
  // Stripe price ID (set after first checkout creation)
  stripePriceId?:   string;
  createdAt:        Date;
  updatedAt:        Date;
}

const PackageConfigSchema = new Schema<IPackageConfig>(
  {
    packageId:    { type: String, required: true, unique: true },
    packageType:  { type: String, enum: ["base","memory_addon","quota_addon","retention_addon"], required: true },
    label:        { type: String, required: true },
    description:  { type: String, default: "" },
    priceThb:             { type: Number, required: true, default: 0 },
    wholesalePriceThb:    { type: Number },
    systemCostThb:        { type: Number },
    stripeFeeThb:         { type: Number },
    msgPerDay:            { type: Number },
    msgPerMonth:          { type: Number },
    extraMsgPerMonth:     { type: Number },
    memoryMb:             { type: Number },
    retentionDays:        { type: Number },
    maxSessionCrossSearch:{ type: Number },
    isActive:     { type: Boolean, default: true },
    isPopular:    { type: Boolean, default: false },
    isEnterprise: { type: Boolean, default: false },
    sortOrder:    { type: Number, default: 0 },
    partnerCost:  { type: Number },
    stripePriceId:{ type: String },
  },
  { timestamps: true }
);

export const PackageConfigModel: Model<IPackageConfig> =
  mongoose.models.PackageConfig ??
  mongoose.model<IPackageConfig>("PackageConfig", PackageConfigSchema);

// ── Seed defaults (called once by admin or seed script) ───────────
export const DEFAULT_PACKAGES: Omit<IPackageConfig, keyof Document | "createdAt" | "updatedAt">[] = [
  // ── Base Plans ──────────────────────────────────────────────────
  {
    packageId: "trial",      packageType: "base",
    label: "Trial",          description: "ทดลองใช้ 14 วัน",
    priceThb: 0,             msgPerDay: 250,
    isActive: true,  isPopular: false, isEnterprise: false, sortOrder: 0,
  },
  {
    packageId: "starter",    packageType: "base",
    label: "Starter",        description: "สำหรับร้านค้าเริ่มต้น",
    priceThb: 990,           wholesalePriceThb: 545,
    msgPerMonth: 2000,
    isActive: true,  isPopular: false, isEnterprise: false, sortOrder: 1,
    partnerCost: 545,
  },
  {
    packageId: "pro",        packageType: "base",
    label: "Pro",            description: "สำหรับร้านค้าที่เติบโต",
    priceThb: 1990,          wholesalePriceThb: 1095,
    msgPerMonth: 5000,
    isActive: true,  isPopular: true,  isEnterprise: false, sortOrder: 2,
    partnerCost: 1095,
  },
  {
    packageId: "master",     packageType: "base",
    label: "Master",         description: "สำหรับธุรกิจขนาดใหญ่",
    priceThb: 14990,         wholesalePriceThb: 8245,
    msgPerMonth: 20000,
    isActive: true,  isPopular: false, isEnterprise: false, sortOrder: 3,
    partnerCost: 8245,
  },
  {
    packageId: "enterprise", packageType: "base",
    label: "Enterprise",     description: "Custom สำหรับองค์กร",
    priceThb: 0,             msgPerMonth: -1,
    isActive: true,  isPopular: false, isEnterprise: true,  sortOrder: 4,
  },

  // ── Quota Add-ons (extra messages/month) ────────────────────────
  {
    packageId: "quota_1k",   packageType: "quota_addon",
    label: "+1,000 ข้อความ/เดือน", description: "เพิ่มโควต้า 1,000 ข้อความต่อเดือน",
    priceThb: 249,           wholesalePriceThb: 137,
    extraMsgPerMonth: 1000,
    isActive: true,  isPopular: false, isEnterprise: false, sortOrder: 1,
    partnerCost: 137,
  },
  {
    packageId: "quota_5k",   packageType: "quota_addon",
    label: "+5,000 ข้อความ/เดือน", description: "เพิ่มโควต้า 5,000 ข้อความต่อเดือน",
    priceThb: 690,           wholesalePriceThb: 380,
    extraMsgPerMonth: 5000,
    isActive: true,  isPopular: true,  isEnterprise: false, sortOrder: 2,
    partnerCost: 380,
  },
  {
    packageId: "quota_20k",  packageType: "quota_addon",
    label: "+20,000 ข้อความ/เดือน", description: "เพิ่มโควต้า 20,000 ข้อความต่อเดือน",
    priceThb: 2290,          wholesalePriceThb: 1260,
    extraMsgPerMonth: 20000,
    isActive: true,  isPopular: false, isEnterprise: false, sortOrder: 3,
    partnerCost: 1260,
  },

  // ── Memory Add-ons (legacy — kept for existing subscriptions) ───
  { packageId: "mem_free",   packageType: "memory_addon", label: "Free (1 MB)",  description: "เหมาะสำหรับทดลองใช้",           priceThb: 0,   memoryMb: 1,    isActive: false, isPopular: false, isEnterprise: false, sortOrder: 1 },
  { packageId: "mem_small",  packageType: "memory_addon", label: "50 MB",        description: "สำหรับสินค้า 50–200 รายการ",    priceThb: 149, memoryMb: 50,   isActive: false, isPopular: false, isEnterprise: false, sortOrder: 2 },
  { packageId: "mem_medium", packageType: "memory_addon", label: "250 MB",       description: "สำหรับ Knowledge Base ขนาดกลาง", priceThb: 399, memoryMb: 250,  isActive: false, isPopular: false, isEnterprise: false, sortOrder: 3 },
  { packageId: "mem_large",  packageType: "memory_addon", label: "1 GB+",        description: "สำหรับ Enterprise",              priceThb: 999, memoryMb: 1024, isActive: false, isPopular: false, isEnterprise: false, sortOrder: 4 },

  // ── Retention Add-ons ───────────────────────────────────────────
  {
    packageId: "ret_7d",     packageType: "retention_addon",
    label: "7 วัน",          description: "รวมในทุกแพ็กเกจ",
    priceThb: 0,             retentionDays: 7,
    isActive: true,  isPopular: false, isEnterprise: false, sortOrder: 1,
  },
  {
    packageId: "ret_30d",    packageType: "retention_addon",
    label: "30 วัน",         description: "เก็บประวัติ 30 วัน",
    priceThb: 349,           wholesalePriceThb: 192,
    retentionDays: 30,
    isActive: true,  isPopular: false, isEnterprise: false, sortOrder: 2,
    partnerCost: 192,
  },
  {
    packageId: "ret_90d",    packageType: "retention_addon",
    label: "90 วัน",         description: "เก็บประวัติ 90 วัน",
    priceThb: 790,           wholesalePriceThb: 435,
    retentionDays: 90,
    isActive: true,  isPopular: true,  isEnterprise: false, sortOrder: 3,
    partnerCost: 435,
  },
  {
    packageId: "ret_life",   packageType: "retention_addon",
    label: "ตลอดชีพ",        description: "จ่ายตามการใช้งาน (Enterprise)",
    priceThb: -1,            retentionDays: -1,
    isActive: true,  isPopular: false, isEnterprise: true,  sortOrder: 4,
  },
];
