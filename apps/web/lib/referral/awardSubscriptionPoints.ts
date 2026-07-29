import { ensureReferralMasterData } from "@/lib/db/pg/ensureReferralMasterData";
import {
  getActiveRuleConfig,
  getRenewalStreak,
  upsertRenewalStreak,
  insertLedgerEntry,
  findLedgerEntryBySourceRef,
} from "@/lib/db/referral";
import { determineRenewalKind, resolvePointsForEvent } from "@/lib/referral/pointsEngine";

export type StreakScope = "plan" | "quota_addon" | "memory_addon" | "retention_addon";

interface ScopedAwardInput {
  tenantId: string;
  scope: StreakScope;
  signupEventType: "plan_signup" | "addon_purchase";
  packageId: string;
  periodStart: Date;
  periodEnd: Date;
  invoiceId: string;
  labelPrefix: string;
}

/**
 * Awards points for one scope (the plan itself, or one addon) on a paid
 * invoice — resolves signup-vs-renewal via the per-scope renewal streak
 * (spec items 5.4/5.6/5.8/7: a gap of >=1 month resets to "signup" pricing),
 * looks up the point value from the admin-configured points_rule_config, and
 * records it in the ledger. Idempotent per (invoiceId, scope) so Stripe
 * webhook retries never double-award.
 */
async function awardScopedPoints(input: ScopedAwardInput): Promise<void> {
  const sourceRefId = `${input.invoiceId}:${input.scope}`;
  if (await findLedgerEntryBySourceRef(sourceRefId)) return;

  const streak = await getRenewalStreak(input.tenantId, input.scope);
  const kind = determineRenewalKind({
    lastPeriodEnd: streak?.lastPeriodEnd ?? null,
    newPeriodStart: input.periodStart,
  });

  const rules = await getActiveRuleConfig();
  const points = resolvePointsForEvent(rules, input.signupEventType, input.packageId, kind);

  if (points != null) {
    await insertLedgerEntry({
      tenantId: input.tenantId,
      eventType: kind === "renewal" ? (input.signupEventType === "plan_signup" ? "plan_renewal" : "addon_renewal") : input.signupEventType,
      points,
      sourceRefId,
      description: `${input.labelPrefix} (${input.packageId}) — ${kind === "renewal" ? "ต่ออายุ" : "สมัครใหม่"}`,
    });
  }

  await upsertRenewalStreak({
    tenantId: input.tenantId,
    scope: input.scope,
    periodEnd: input.periodEnd,
    streakStartAt: kind === "renewal" ? (streak?.streakStartAt ?? input.periodStart) : input.periodStart,
  });
}

export interface AwardSubscriptionPointsInput {
  tenantId: string;
  invoiceId: string;
  planId: string;
  quotaOrMemoryAddonId?: string | null;
  retentionAddonId?: string | null;
  periodStart: Date;
  periodEnd: Date;
}

const NO_ADDON_IDS = new Set(["free", "none", "standard"]);

export async function awardSubscriptionPoints(input: AwardSubscriptionPointsInput): Promise<void> {
  await ensureReferralMasterData();

  await awardScopedPoints({
    tenantId: input.tenantId,
    scope: "plan",
    signupEventType: "plan_signup",
    packageId: input.planId,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    invoiceId: input.invoiceId,
    labelPrefix: "สมัครใช้งานแพ็กเกจ",
  });

  if (input.quotaOrMemoryAddonId && !NO_ADDON_IDS.has(input.quotaOrMemoryAddonId)) {
    await awardScopedPoints({
      tenantId: input.tenantId,
      scope: "quota_addon",
      signupEventType: "addon_purchase",
      packageId: input.quotaOrMemoryAddonId,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      invoiceId: input.invoiceId,
      labelPrefix: "ซื้อบริการเพิ่มเติม (โควต้า/หน่วยความจำ)",
    });
  }

  if (input.retentionAddonId && !NO_ADDON_IDS.has(input.retentionAddonId)) {
    await awardScopedPoints({
      tenantId: input.tenantId,
      scope: "retention_addon",
      signupEventType: "addon_purchase",
      packageId: input.retentionAddonId,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      invoiceId: input.invoiceId,
      labelPrefix: "ซื้อบริการเพิ่มเติม (ระยะเวลาจดจำบทสนทนา)",
    });
  }
}
