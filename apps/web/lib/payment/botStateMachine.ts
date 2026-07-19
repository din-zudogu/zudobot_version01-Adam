/**
 * Bot State Machine
 *
 * States (from Master Config spec):
 *   trial → trial_expired → active → grace_5pct → suspended_quota | suspended_payment → cancelled
 *
 * All thresholds are configurable via Master Config (Group A–C).
 * This module handles transitions only — no DB writes. Callers persist the result.
 */

import type { BotState } from "@/types";

export interface BotStateContext {
  current:            BotState;
  trialEndsAt?:       Date | null;
  dailyMsgCount:      number;
  dailyQuotaCap:      number;        // from Master Config Group A
  quotaGraceBuffer:   number;        // e.g. 0.05 = 5%
  subscriptionStatus: "none" | "trialing" | "active" | "past_due" | "canceled" | "unpaid";
  graceDueDate?:      Date | null;
  now?:               Date;
}

export type StateTransition = {
  nextState: BotState;
  reason: string;
};

export function evaluateBotState(ctx: BotStateContext): StateTransition {
  const now = ctx.now ?? new Date();
  const {
    current,
    trialEndsAt,
    dailyMsgCount,
    dailyQuotaCap,
    quotaGraceBuffer,
    subscriptionStatus,
    graceDueDate,
  } = ctx;

  // -1 = unlimited quota (monthly paid plans); skip all daily-cap checks
  const hasUnlimitedQuota = dailyQuotaCap < 0;
  const graceQuotaCap = hasUnlimitedQuota ? Infinity : Math.floor(dailyQuotaCap * (1 + quotaGraceBuffer));

  // ── Trial states ────────────────────────────────────────────────
  if (current === "trial" || current === "trial_quota_daily_exhausted") {
    // Trial expired by date
    if (trialEndsAt && now > trialEndsAt) {
      return { nextState: "trial_expired", reason: "trial_period_ended" };
    }
    // Daily quota exhausted
    if (!hasUnlimitedQuota && dailyMsgCount >= dailyQuotaCap) {
      return { nextState: "trial_quota_daily_exhausted", reason: "daily_quota_exhausted" };
    }
    // Reset: new day, quota available again
    if (current === "trial_quota_daily_exhausted" && (hasUnlimitedQuota || dailyMsgCount < dailyQuotaCap)) {
      return { nextState: "trial", reason: "quota_reset_new_day" };
    }
    return { nextState: current, reason: "no_change" };
  }

  // ── Trial expired ───────────────────────────────────────────────
  if (current === "trial_expired") {
    if (subscriptionStatus === "active") {
      return { nextState: "active", reason: "subscription_activated" };
    }
    return { nextState: "trial_expired", reason: "no_change" };
  }

  // ── Active ──────────────────────────────────────────────────────
  if (current === "active") {
    // Quota exceeded into grace buffer (skip if unlimited)
    if (!hasUnlimitedQuota && dailyMsgCount > dailyQuotaCap && dailyMsgCount <= graceQuotaCap) {
      return { nextState: "grace_5pct", reason: "quota_in_grace_buffer" };
    }
    // Hard limit exceeded (skip if unlimited)
    if (!hasUnlimitedQuota && dailyMsgCount > graceQuotaCap) {
      return { nextState: "suspended_quota", reason: "quota_exceeded_hard_limit" };
    }
    // Payment failed
    if (subscriptionStatus === "past_due" || subscriptionStatus === "unpaid") {
      return { nextState: "grace_5pct", reason: "payment_past_due" };
    }
    // Subscription cancelled
    if (subscriptionStatus === "canceled") {
      return { nextState: "suspended_payment", reason: "subscription_canceled" };
    }
    return { nextState: "active", reason: "no_change" };
  }

  // ── Grace 5% ────────────────────────────────────────────────────
  if (current === "grace_5pct") {
    // Hard quota exceeded (skip if unlimited)
    if (!hasUnlimitedQuota && dailyMsgCount > graceQuotaCap) {
      return { nextState: "suspended_quota", reason: "grace_quota_exceeded" };
    }
    // Grace period expired
    if (graceDueDate && now > graceDueDate) {
      return { nextState: "suspended_payment", reason: "grace_period_expired" };
    }
    // Payment recovered
    if (subscriptionStatus === "active" && (hasUnlimitedQuota || dailyMsgCount <= dailyQuotaCap)) {
      return { nextState: "active", reason: "payment_recovered" };
    }
    return { nextState: "grace_5pct", reason: "no_change" };
  }

  // ── Suspended ───────────────────────────────────────────────────
  if (current === "suspended_quota" || current === "suspended_payment") {
    // Reactivated by valid subscription
    if (subscriptionStatus === "active") {
      return { nextState: "active", reason: "reactivated_by_payment" };
    }
    return { nextState: current, reason: "no_change" };
  }

  return { nextState: current, reason: "no_change" };
}

/** Returns true if the bot is allowed to respond to messages */
export function canBotRespond(state: BotState): boolean {
  return state === "trial" || state === "active" || state === "grace_5pct";
}

/** Returns a human-readable Thai status label */
export function botStateLabel(state: BotState): string {
  const labels: Record<BotState, string> = {
    trial:                     "ทดลองใช้",
    trial_quota_daily_exhausted: "โควต้าวันนี้หมด",
    trial_expired:             "หมดอายุทดลอง",
    active:                    "ใช้งานอยู่",
    grace_5pct:                "ช่วงผ่อนผัน",
    suspended_quota:           "ระงับ (โควต้า)",
    suspended_payment:         "ระงับ (การชำระ)",
    pending_kyc:               "รอยืนยันตัวตน",
    disabled:                  "ปิดการใช้งาน",
  };
  return labels[state] ?? state;
}
