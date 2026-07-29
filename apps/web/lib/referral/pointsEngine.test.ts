import { describe, it, expect } from "vitest";
import {
  generateSecretCode,
  computeCycleStart,
  computeCycleEnd,
  determineRenewalKind,
  resolvePointsForEvent,
  computeEligibleTiers,
  applyRedemption,
  sumActiveBonus,
  type PointsRuleRow,
  type RewardTierRow,
} from "./pointsEngine";

describe("generateSecretCode", () => {
  it("returns a 16-char hex string and is not trivially predictable", () => {
    const a = generateSecretCode();
    const b = generateSecretCode();
    expect(a).toMatch(/^[0-9a-f]{16}$/);
    expect(a).not.toBe(b);
  });
});

describe("computeCycleStart / computeCycleEnd", () => {
  it("anchors to the signup month/day within the current year when before the anniversary", () => {
    const signup = new Date("2024-03-10T00:00:00Z");
    const now = new Date("2026-03-05T00:00:00Z"); // before this year's anniversary
    const start = computeCycleStart(signup, now);
    expect(start.getUTCFullYear()).toBe(2025);
    expect(start.getUTCMonth()).toBe(2); // March
    expect(start.getUTCDate()).toBe(10);
  });

  it("rolls forward to this year's anniversary once it has passed", () => {
    const signup = new Date("2024-03-10T00:00:00Z");
    const now = new Date("2026-03-15T00:00:00Z"); // after this year's anniversary
    const start = computeCycleStart(signup, now);
    expect(start.getUTCFullYear()).toBe(2026);
    expect(start.getUTCMonth()).toBe(2);
    expect(start.getUTCDate()).toBe(10);
  });

  it("treats the anniversary date itself as the start of the new cycle", () => {
    const signup = new Date("2024-03-10T00:00:00Z");
    const now = new Date("2026-03-10T00:00:00Z");
    const start = computeCycleStart(signup, now);
    expect(start.getUTCFullYear()).toBe(2026);
  });

  it("computeCycleEnd is exactly one year after cycleStart", () => {
    const start = new Date("2026-03-10T00:00:00Z");
    const end = computeCycleEnd(start);
    expect(end.getUTCFullYear()).toBe(2027);
    expect(end.getUTCMonth()).toBe(start.getUTCMonth());
    expect(end.getUTCDate()).toBe(start.getUTCDate());
  });
});

describe("determineRenewalKind", () => {
  it("is 'signup' when there is no prior streak", () => {
    expect(determineRenewalKind({ lastPeriodEnd: null, newPeriodStart: new Date("2026-01-01") })).toBe("signup");
  });

  it("is 'renewal' when the new period starts right after the last one ended", () => {
    const lastPeriodEnd = new Date("2026-01-31T00:00:00Z");
    const newPeriodStart = new Date("2026-02-01T00:00:00Z");
    expect(determineRenewalKind({ lastPeriodEnd, newPeriodStart })).toBe("renewal");
  });

  it("is 'renewal' at exactly a 1-month gap plus grace tolerance", () => {
    const lastPeriodEnd = new Date("2026-01-01T00:00:00Z");
    const newPeriodStart = new Date("2026-02-01T00:00:00Z"); // exactly 1 month later
    expect(determineRenewalKind({ lastPeriodEnd, newPeriodStart, graceDays: 0 })).toBe("renewal");
  });

  it("is 'signup' once the gap exceeds 1 month (even by a day past grace)", () => {
    const lastPeriodEnd = new Date("2026-01-01T00:00:00Z");
    const newPeriodStart = new Date("2026-03-10T00:00:00Z"); // >1 month gap
    expect(determineRenewalKind({ lastPeriodEnd, newPeriodStart, graceDays: 5 })).toBe("signup");
  });
});

describe("resolvePointsForEvent", () => {
  const rules: PointsRuleRow[] = [
    { eventType: "referral", packageId: null, points: 50, isActive: true },
    { eventType: "plan_signup", packageId: "zudobot_pro_monthly", points: 70, isActive: true },
    { eventType: "plan_renewal", packageId: "zudobot_pro_monthly", points: 100, isActive: true },
    { eventType: "addon_purchase", packageId: "addon_mini", points: 10, isActive: true },
    { eventType: "addon_renewal", packageId: "addon_mini", points: 20, isActive: true },
    { eventType: "plan_signup", packageId: "disabled_plan", points: 999, isActive: false },
  ];

  it("resolves the referral rule with a null packageId", () => {
    expect(resolvePointsForEvent(rules, "referral", null, "signup")).toBe(50);
  });

  it("resolves plan_signup vs plan_renewal by kind", () => {
    expect(resolvePointsForEvent(rules, "plan_signup", "zudobot_pro_monthly", "signup")).toBe(70);
    expect(resolvePointsForEvent(rules, "plan_signup", "zudobot_pro_monthly", "renewal")).toBe(100);
  });

  it("resolves addon_purchase vs addon_renewal by kind", () => {
    expect(resolvePointsForEvent(rules, "addon_purchase", "addon_mini", "signup")).toBe(10);
    expect(resolvePointsForEvent(rules, "addon_purchase", "addon_mini", "renewal")).toBe(20);
  });

  it("returns null when no active rule matches", () => {
    expect(resolvePointsForEvent(rules, "plan_signup", "unknown_plan", "signup")).toBeNull();
    expect(resolvePointsForEvent(rules, "plan_signup", "disabled_plan", "signup")).toBeNull();
  });
});

describe("reward tiers — boundary values from spec items 4.1-4.6", () => {
  const tiers: RewardTierRow[] = [
    { id: "t1", minPoints: 51, maxPoints: 100, costPoints: 51, bonusMsgPerMonth: 10, bonusRetentionDays: 0, bonusMemoryMb: 0, isActive: true },
    { id: "t2", minPoints: 101, maxPoints: 250, costPoints: 101, bonusMsgPerMonth: 20, bonusRetentionDays: 0, bonusMemoryMb: 0, isActive: true },
    { id: "t3", minPoints: 251, maxPoints: 500, costPoints: 251, bonusMsgPerMonth: 20, bonusRetentionDays: 7, bonusMemoryMb: 0, isActive: true },
    { id: "t4", minPoints: 501, maxPoints: 700, costPoints: 501, bonusMsgPerMonth: 30, bonusRetentionDays: 14, bonusMemoryMb: 0, isActive: true },
    { id: "t5", minPoints: 701, maxPoints: 1000, costPoints: 701, bonusMsgPerMonth: 30, bonusRetentionDays: 30, bonusMemoryMb: 4, isActive: true },
  ];

  it("grants no eligible tier below 51 points", () => {
    expect(computeEligibleTiers(tiers, 50)).toHaveLength(0);
  });

  it("unlocks exactly tier 1 at 51 points, not tier 2 until 101", () => {
    expect(computeEligibleTiers(tiers, 51).map((t) => t.id)).toEqual(["t1"]);
    expect(computeEligibleTiers(tiers, 100).map((t) => t.id)).toEqual(["t1"]);
    expect(computeEligibleTiers(tiers, 101).map((t) => t.id)).toEqual(["t1", "t2"]);
  });

  it("unlocks every tier once balance reaches 701", () => {
    expect(computeEligibleTiers(tiers, 701).map((t) => t.id)).toEqual(["t1", "t2", "t3", "t4", "t5"]);
  });

  it("ignores inactive tiers", () => {
    const withInactive: RewardTierRow[] = [...tiers, { id: "t6", minPoints: 1001, maxPoints: null, costPoints: 1001, bonusMsgPerMonth: 999, bonusRetentionDays: 999, bonusMemoryMb: 999, isActive: false }];
    expect(computeEligibleTiers(withInactive, 5000).map((t) => t.id)).not.toContain("t6");
  });
});

describe("applyRedemption", () => {
  const tier: RewardTierRow = { id: "t1", minPoints: 51, maxPoints: 100, costPoints: 51, bonusMsgPerMonth: 10, bonusRetentionDays: 0, bonusMemoryMb: 0, isActive: true };

  it("deducts cost from balance on success", () => {
    const result = applyRedemption(tier, 60);
    expect(result.ok).toBe(true);
    expect(result.newBalance).toBe(9);
  });

  it("rejects when balance is below cost", () => {
    const result = applyRedemption(tier, 50);
    expect(result.ok).toBe(false);
    expect(result.error).toBe("insufficient_points");
    expect(result.newBalance).toBe(50);
  });

  it("rejects redeeming an inactive tier even with enough balance", () => {
    const result = applyRedemption({ ...tier, isActive: false }, 1000);
    expect(result.ok).toBe(false);
    expect(result.error).toBe("inactive_tier");
  });
});

describe("sumActiveBonus", () => {
  it("returns all-zero bonus when there is no active redemption", () => {
    expect(sumActiveBonus(null)).toEqual({ bonusMsgPerMonth: 0, bonusRetentionDays: 0, bonusMemoryMb: 0 });
  });

  it("returns the active tier's bonus fields", () => {
    const tier: RewardTierRow = { id: "t5", minPoints: 701, maxPoints: 1000, costPoints: 701, bonusMsgPerMonth: 30, bonusRetentionDays: 30, bonusMemoryMb: 4, isActive: true };
    expect(sumActiveBonus(tier)).toEqual({ bonusMsgPerMonth: 30, bonusRetentionDays: 30, bonusMemoryMb: 4 });
  });
});
