/**
 * svc_referral_points — "บอกต่อ" (Recommend) points rules engine.
 *
 * All business rules are driven by Postgres master config
 * (points_rule_config / reward_tiers). This module translates those rows
 * plus event data into decisions. No DB access — pure functions, easy to
 * test (mirrors lib/payment/pmRules.ts).
 */
import { randomBytes } from "crypto";

// ── Secret codes ──────────────────────────────────────────────────
export function generateSecretCode(): string {
  return randomBytes(8).toString("hex"); // 16 hex chars
}

// ── Points cycle (1 year from tenant's own signup date, renews yearly) ──
export function computeCycleStart(signupDate: Date, now: Date = new Date()): Date {
  const cycleStart = new Date(signupDate);
  cycleStart.setFullYear(now.getFullYear());
  if (cycleStart > now) {
    cycleStart.setFullYear(cycleStart.getFullYear() - 1);
  }
  return cycleStart;
}

export function computeCycleEnd(cycleStart: Date): Date {
  const cycleEnd = new Date(cycleStart);
  cycleEnd.setFullYear(cycleEnd.getFullYear() + 1);
  return cycleEnd;
}

// ── Renewal streak detection ────────────────────────────────────────
export type RenewalKind = "signup" | "renewal";

export interface RenewalKindInput {
  lastPeriodEnd: Date | null; // null = no prior streak on record
  newPeriodStart: Date;
  graceDays?: number; // tolerance for early/late renewal timing, default 5
}

/**
 * A gap of >=1 month between the prior period's end and the new period's
 * start resets the streak — that next payment is scored as a fresh
 * "signup", not a "renewal" (spec items 5.4/5.6/5.8/7).
 */
export function determineRenewalKind({ lastPeriodEnd, newPeriodStart, graceDays = 5 }: RenewalKindInput): RenewalKind {
  if (!lastPeriodEnd) return "signup";

  const oneMonthLater = new Date(lastPeriodEnd);
  oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);
  oneMonthLater.setDate(oneMonthLater.getDate() + graceDays);

  return newPeriodStart <= oneMonthLater ? "renewal" : "signup";
}

// ── Points rule resolution ──────────────────────────────────────────
export interface PointsRuleRow {
  eventType: string;
  packageId: string | null;
  points: number;
  isActive: boolean;
}

export function resolvePointsForEvent(
  rules: PointsRuleRow[],
  eventType: string,
  packageId: string | null,
  kind: RenewalKind
): number | null {
  const wantedEventType = kind === "renewal"
    ? (eventType === "plan_signup" ? "plan_renewal" : eventType === "addon_purchase" ? "addon_renewal" : eventType)
    : eventType;

  const match = rules.find(
    (r) => r.isActive && r.eventType === wantedEventType && r.packageId === packageId
  );
  return match ? match.points : null;
}

// ── Reward tiers ──────────────────────────────────────────────────
export interface RewardTierRow {
  id: string;
  minPoints: number;
  maxPoints: number | null;
  costPoints: number;
  bonusMsgPerMonth: number;
  bonusRetentionDays: number;
  bonusMemoryMb: number;
  isActive: boolean;
}

/** Tiers the tenant can currently afford to redeem, ordered cheapest first. */
export function computeEligibleTiers(tiers: RewardTierRow[], balance: number): RewardTierRow[] {
  return tiers
    .filter((t) => t.isActive && balance >= t.costPoints)
    .sort((a, b) => a.costPoints - b.costPoints);
}

export interface RedemptionResult {
  ok: boolean;
  newBalance: number;
  error?: "insufficient_points" | "inactive_tier";
}

export function applyRedemption(tier: RewardTierRow, balance: number): RedemptionResult {
  if (!tier.isActive) return { ok: false, newBalance: balance, error: "inactive_tier" };
  if (balance < tier.costPoints) return { ok: false, newBalance: balance, error: "insufficient_points" };
  return { ok: true, newBalance: balance - tier.costPoints };
}

export interface RewardBonus {
  bonusMsgPerMonth: number;
  bonusRetentionDays: number;
  bonusMemoryMb: number;
}

const NO_BONUS: RewardBonus = { bonusMsgPerMonth: 0, bonusRetentionDays: 0, bonusMemoryMb: 0 };

export function sumActiveBonus(activeTier: RewardTierRow | null): RewardBonus {
  if (!activeTier) return NO_BONUS;
  return {
    bonusMsgPerMonth: activeTier.bonusMsgPerMonth,
    bonusRetentionDays: activeTier.bonusRetentionDays,
    bonusMemoryMb: activeTier.bonusMemoryMb,
  };
}
