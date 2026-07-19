// ── Role System ──────────────────────────────────────────────────
export type UserRole = "super_admin" | "admin" | "tenant";

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

// ── Pricing ──────────────────────────────────────────────────────
export type BasePlanId = "trial" | "starter" | "pro" | "master" | "enterprise";
export type MemoryAddonId = "free" | "small" | "medium" | "large";
export type RetentionAddonId = "standard" | "1month" | "3months" | "6months" | "lifetime";

// ── Notification ─────────────────────────────────────────────────
export type NotificationType =
  | "quota_alert_80"
  | "quota_alert_95"
  | "quota_exhausted"
  | "quota_suspended"
  | "trial_quota_daily"
  | "trial_expiry_3days"
  | "trial_expired"
  | "payment_success"
  | "payment_failed"
  | "payment_suspended"
  | "retention_warning"
  | "memory_full"
  | "kyc_approved"
  | "kyc_rejected"
  | "plan_upgraded"
  | "system_announcement";

// ── Master Config Groups ──────────────────────────────────────────
export interface PlatformSettings {
  // Group A — Trial
  trialDurationDays: number;
  trialDailyQuotaCap: number;
  trialQuotaExhaustedBotMessage: string;
  trialQuotaExhaustedEmailSubject: string;
  trialQuotaExhaustedEmailBody: string;

  // Group B — Quota
  quotaAlertThresholds: number[];
  quotaGraceBufferPercent: number;
  quotaExhaustedBotMessage: string;

  // Group C — Payment Grace
  nonEnterpriseRenewalGraceDays: number;
  enterpriseInvoiceGraceDays: number;
  enterpriseBillingAlertDays: number;

  // Group D — Bot Behavior
  sessionTimeoutMinutes: number;
  minimumEngagementSeconds: number;
  amnesiaMessageTemplate: string;
  retentionWarningDays: number;
  geminiDownMessage: string;

  // Group E — Centralized Data
  centralizedRetentionYears: number;
  centralizedCleanupDayOfMonth: number;

  // Group F — Sandbox
  sandboxRateLimitPerHour: number;
  sandboxAccountMessageLimit: number;
  sandboxCtaTriggerAfterMessages: number;
  sandboxCtaMessage: string;

  // Group G — Financial
  vatRate: number;
  enterpriseCostPlusMultiplier: number;
  whtRate: number;

  // Group H — CDN & Widget
  widgetCdnBaseUrl: string;
  widgetStableVersion: string;
  widgetLatestVersion: string;

  // Group I — Legal & Compliance
  privacyPolicyHtml: string;
  privacyPolicyUrl: string;
  widgetDisclaimerMessage: string;
  pdpaContextLink: string;

  // Group J — Tax & Invoice
  invoiceSellerName: string;
  invoiceSellerTaxId: string;
  invoiceSellerAddress: string;
  invoiceSellerPhone: string;
  invoiceSellerEmail: string;
  invoiceSellerIsVatRegistered: boolean;
  invoiceNumberPrefix: string;
  invoiceDueDays: number;
  invoiceWhtThreshold: number;
  invoiceReceiptFooterNote: string;
  invoiceReceiptShowVat: boolean;
  invoiceReceiptShowWht: boolean;
}

// ── Tenant ────────────────────────────────────────────────────────
export interface TenantProfile {
  id: string;
  email: string;
  name: string;
  role: "tenant";
  tenantId: string;
  botState: BotState;
  planId: BasePlanId;
  planName: string;
  quotaUsed: number;
  quotaTotal: number;
  quotaResetDate: string;
  memoryUsedMb: number;
  memoryTotalMb: number;
  retentionDays: number;
  retentionExpiresAt?: string;
  nextBillingDate?: string;
  trialEndsAt?: string;
  isVerified: boolean;
}
