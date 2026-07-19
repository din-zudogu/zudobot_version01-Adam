/**
 * svc_pm_rules — Payment Rules Engine
 *
 * All business rules are driven by Master Config.
 * This module translates config values into enforceable decisions.
 * No DB access — pure functions, easy to test.
 */

// ── Plan catalog ──────────────────────────────────────────────────
export const PLAN_CATALOG = {
  starter:    { priceThb: 990,   wholesalePriceThb: 545,  msgPerMonth: 2000,  label: "Starter" },
  pro:        { priceThb: 1990,  wholesalePriceThb: 1095, msgPerMonth: 5000,  label: "Pro" },
  master:     { priceThb: 14990, wholesalePriceThb: 8245, msgPerMonth: 20000, label: "Master" },
  enterprise: { priceThb: 0,     wholesalePriceThb: 0,    msgPerMonth: -1,    label: "Enterprise" },
  trial:      { priceThb: 0,     wholesalePriceThb: 0,    msgPerDay: 250,     label: "Trial" },
} as const;
export type PlanId = keyof typeof PLAN_CATALOG;

// ── Quota add-on catalog (extra messages/month) ───────────────────
export const QUOTA_ADDON_CATALOG = {
  none:       { priceThb: 0,    wholesalePriceThb: 0,    extraMsg: 0,     label: "ไม่มี" },
  quota_1k:   { priceThb: 249,  wholesalePriceThb: 137,  extraMsg: 1000,  label: "+1,000 ข้อความ/เดือน" },
  quota_5k:   { priceThb: 690,  wholesalePriceThb: 380,  extraMsg: 5000,  label: "+5,000 ข้อความ/เดือน" },
  quota_20k:  { priceThb: 2290, wholesalePriceThb: 1260, extraMsg: 20000, label: "+20,000 ข้อความ/เดือน" },
} as const;
export type QuotaAddonId = keyof typeof QUOTA_ADDON_CATALOG;

// ── Memory add-on catalog (legacy — kept for existing subscriptions) ──
export const MEMORY_ADDON_CATALOG = {
  free:   { priceThb: 0,   mb: 1,    label: "Free (1 MB)" },
  small:  { priceThb: 149, mb: 50,   label: "50 MB" },
  medium: { priceThb: 399, mb: 250,  label: "250 MB" },
  large:  { priceThb: 999, mb: 1024, label: "1 GB+" },
} as const;
export type MemoryAddonId = keyof typeof MEMORY_ADDON_CATALOG;

// ── Retention add-on catalog ──────────────────────────────────────
export const RETENTION_ADDON_CATALOG = {
  standard: { priceThb: 0,   wholesalePriceThb: 0,   days: 7,  label: "7 วัน" },
  ret_30d:  { priceThb: 349, wholesalePriceThb: 192,  days: 30, label: "30 วัน" },
  ret_90d:  { priceThb: 790, wholesalePriceThb: 435,  days: 90, label: "90 วัน" },
  lifetime: { priceThb: -1,  wholesalePriceThb: -1,   days: -1, label: "ตลอดชีพ (Enterprise)" },
  // Legacy keys kept for existing subscriptions
  "1month":  { priceThb: 99,  wholesalePriceThb: 0,  days: 30,  label: "1 เดือน" },
  "3months": { priceThb: 199, wholesalePriceThb: 0,  days: 90,  label: "3 เดือน" },
  "6months": { priceThb: 299, wholesalePriceThb: 0,  days: 180, label: "6 เดือน" },
} as const;
export type RetentionAddonId = keyof typeof RETENTION_ADDON_CATALOG;

// ── Config interface ──────────────────────────────────────────────
export interface PmConfig {
  trialDurationDays:          number;   // 14
  trialDailyQuotaCap:         number;   // 250
  quotaGraceBufferPercent:    number;   // 5
  nonEnterpriseGraceDays:     number;   // 7
  enterpriseInvoiceGraceDays: number;   // 30
  vatRate:                    number;   // 0.07
  whtRate:                    number;   // 0.03
}

export const DEFAULT_PM_CONFIG: PmConfig = {
  trialDurationDays:          14,
  trialDailyQuotaCap:         250,
  quotaGraceBufferPercent:    5,
  nonEnterpriseGraceDays:     7,
  enterpriseInvoiceGraceDays: 30,
  vatRate:                    0.07,
  whtRate:                    0.03,
};

// ── Pricing calculation ───────────────────────────────────────────
export interface PriceBreakdown {
  base:      number;
  quota:     number;  // quota add-on (was: memory)
  retention: number;
  subtotal:  number;
  vat:       number;
  wht:       number;
  total:     number;
}

export function calculatePrice(
  planId: PlanId,
  quotaAddonId: QuotaAddonId | MemoryAddonId,
  retentionId: RetentionAddonId,
  cfg: Pick<PmConfig, "vatRate" | "whtRate">
): PriceBreakdown {
  const base  = PLAN_CATALOG[planId].priceThb;

  // Resolve quota/memory add-on price
  let quotaPrice = 0;
  if (quotaAddonId in QUOTA_ADDON_CATALOG) {
    quotaPrice = QUOTA_ADDON_CATALOG[quotaAddonId as QuotaAddonId].priceThb;
  } else if (quotaAddonId in MEMORY_ADDON_CATALOG) {
    quotaPrice = MEMORY_ADDON_CATALOG[quotaAddonId as MemoryAddonId].priceThb;
  }

  const retRaw = RETENTION_ADDON_CATALOG[retentionId]?.priceThb ?? 0;
  const retention = retRaw < 0 ? 0 : retRaw;

  const subtotal = base + quotaPrice + retention;
  const vat      = Math.round(subtotal * cfg.vatRate);
  const wht      = Math.round(subtotal * cfg.whtRate);
  const total    = subtotal + vat - wht;
  return { base, quota: quotaPrice, retention, subtotal, vat, wht, total };
}

// ── Trial rules ───────────────────────────────────────────────────
export function trialExpiresAt(startDate: Date, cfg: Pick<PmConfig, "trialDurationDays">): Date {
  const d = new Date(startDate);
  d.setDate(d.getDate() + cfg.trialDurationDays);
  return d;
}

export function isTrialExpired(trialEndsAt: Date, now = new Date()): boolean {
  return now > trialEndsAt;
}

export function dailyQuotaRemaining(dailyCount: number, cap: number): number {
  return Math.max(0, cap - dailyCount);
}

export function isInGraceBuffer(
  count: number,
  cap: number,
  gracePercent: number
): boolean {
  const graceCap = Math.floor(cap * (1 + gracePercent / 100));
  return count > cap && count <= graceCap;
}

export function isQuotaHardExceeded(
  count: number,
  cap: number,
  gracePercent: number
): boolean {
  const graceCap = Math.floor(cap * (1 + gracePercent / 100));
  return count > graceCap;
}

// ── Grace period ──────────────────────────────────────────────────
export function graceDueDate(
  gracStartedAt: Date,
  isEnterprise: boolean,
  cfg: Pick<PmConfig, "nonEnterpriseGraceDays" | "enterpriseInvoiceGraceDays">
): Date {
  const days = isEnterprise ? cfg.enterpriseInvoiceGraceDays : cfg.nonEnterpriseGraceDays;
  const d = new Date(gracStartedAt);
  d.setDate(d.getDate() + days);
  return d;
}

export function isGraceExpired(dueDate: Date, now = new Date()): boolean {
  return now > dueDate;
}

// ── Quota cap per plan ────────────────────────────────────────────
export function monthlyCapForPlan(planId: PlanId): number {
  const plan = PLAN_CATALOG[planId];
  return "msgPerMonth" in plan ? plan.msgPerMonth : -1;
}

export function dailyCapForPlan(planId: PlanId): number {
  const plan = PLAN_CATALOG[planId];
  return "msgPerDay" in plan ? (plan as { msgPerDay: number }).msgPerDay : -1;
}
