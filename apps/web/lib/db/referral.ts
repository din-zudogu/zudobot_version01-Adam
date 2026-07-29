import { and, asc, desc, eq, gte } from "drizzle-orm";
import { getPostgresDb } from "@/lib/db/postgres";
import {
  referralInvites,
  pointsLedger,
  pointsRuleConfig,
  rewardTiers,
  activeRedemptions,
  renewalStreaks,
} from "@/lib/db/pg/schema";
import { computeCycleStart, computeCycleEnd } from "@/lib/referral/pointsEngine";

// Thin query helpers over the referral/points tables — keeps route handlers
// free of raw Drizzle query-building (mirrors lib/db/gitInstall.ts).

export type ReferralInviteRow = typeof referralInvites.$inferSelect;
export type PointsLedgerRow = typeof pointsLedger.$inferSelect;
export type PointsRuleRow = typeof pointsRuleConfig.$inferSelect;
export type RewardTierRow = typeof rewardTiers.$inferSelect;
export type ActiveRedemptionRow = typeof activeRedemptions.$inferSelect;
export type RenewalStreakRow = typeof renewalStreaks.$inferSelect;

// ── Invites ─────────────────────────────────────────────────────────

export async function createReferralInvite(input: {
  referrerTenantId: string;
  inviteeEmail: string;
  secretCode: string;
  shopNameHint?: string;
  expiresAt: Date;
}): Promise<ReferralInviteRow> {
  const db = getPostgresDb();
  const [row] = await db
    .insert(referralInvites)
    .values({
      referrerTenantId: input.referrerTenantId,
      inviteeEmail: input.inviteeEmail.toLowerCase(),
      secretCode: input.secretCode,
      shopNameHint: input.shopNameHint,
      expiresAt: input.expiresAt,
    })
    .returning();
  return row;
}

export async function findInviteBySecretCode(secretCode: string): Promise<ReferralInviteRow | null> {
  const db = getPostgresDb();
  const [row] = await db.select().from(referralInvites).where(eq(referralInvites.secretCode, secretCode)).limit(1);
  return row ?? null;
}

export async function findPendingInviteForReferrer(
  referrerTenantId: string,
  inviteeEmail: string
): Promise<ReferralInviteRow | null> {
  const db = getPostgresDb();
  const [row] = await db
    .select()
    .from(referralInvites)
    .where(
      and(
        eq(referralInvites.referrerTenantId, referrerTenantId),
        eq(referralInvites.inviteeEmail, inviteeEmail.toLowerCase()),
        eq(referralInvites.status, "sent")
      )
    )
    .orderBy(desc(referralInvites.createdAt))
    .limit(1);
  return row ?? null;
}

export async function findPendingInviteForReferredTenant(referredTenantId: string): Promise<ReferralInviteRow | null> {
  const db = getPostgresDb();
  const [row] = await db
    .select()
    .from(referralInvites)
    .where(
      and(
        eq(referralInvites.referredTenantId, referredTenantId),
        eq(referralInvites.status, "signed_up"),
        eq(referralInvites.pointsAwarded, false)
      )
    )
    .limit(1);
  return row ?? null;
}

export async function markInviteSignedUp(id: string, referredTenantId: string): Promise<void> {
  const db = getPostgresDb();
  await db
    .update(referralInvites)
    .set({ status: "signed_up", referredTenantId, signedUpAt: new Date() })
    .where(eq(referralInvites.id, id));
}

export async function markInviteInstalled(id: string): Promise<void> {
  const db = getPostgresDb();
  await db
    .update(referralInvites)
    .set({ status: "installed", installedAt: new Date(), pointsAwarded: true })
    .where(eq(referralInvites.id, id));
}

export async function listInvitesForReferrer(referrerTenantId: string): Promise<ReferralInviteRow[]> {
  const db = getPostgresDb();
  return db
    .select()
    .from(referralInvites)
    .where(eq(referralInvites.referrerTenantId, referrerTenantId))
    .orderBy(desc(referralInvites.createdAt));
}

export async function listAllInvites(): Promise<ReferralInviteRow[]> {
  const db = getPostgresDb();
  return db.select().from(referralInvites).orderBy(desc(referralInvites.createdAt));
}

// ── Points ledger / balance ──────────────────────────────────────────

export async function insertLedgerEntry(input: {
  tenantId: string;
  eventType: string;
  points: number;
  sourceRefId?: string;
  description?: string;
}): Promise<PointsLedgerRow> {
  const db = getPostgresDb();
  const [row] = await db
    .insert(pointsLedger)
    .values({
      tenantId: input.tenantId,
      eventType: input.eventType,
      points: input.points,
      sourceRefId: input.sourceRefId,
      description: input.description,
    })
    .returning();
  return row;
}

export async function findLedgerEntryBySourceRef(sourceRefId: string): Promise<PointsLedgerRow | null> {
  const db = getPostgresDb();
  const [row] = await db.select().from(pointsLedger).where(eq(pointsLedger.sourceRefId, sourceRefId)).limit(1);
  return row ?? null;
}

export interface PointsBalance {
  balance: number;
  cycleStart: Date;
  cycleEnd: Date;
}

/** Current-cycle balance — sums the ledger from the tenant's anniversary-anchored cycle start. */
export async function getPointsBalance(tenantId: string, signupDate: Date, now: Date = new Date()): Promise<PointsBalance> {
  const cycleStart = computeCycleStart(signupDate, now);
  const db = getPostgresDb();
  const rows = await db
    .select({ points: pointsLedger.points })
    .from(pointsLedger)
    .where(and(eq(pointsLedger.tenantId, tenantId), gte(pointsLedger.earnedAt, cycleStart)));
  const balance = rows.reduce((sum, r) => sum + r.points, 0);
  return { balance, cycleStart, cycleEnd: computeCycleEnd(cycleStart) };
}

// ── Admin master config ──────────────────────────────────────────────

export async function getActiveRuleConfig(): Promise<PointsRuleRow[]> {
  const db = getPostgresDb();
  return db.select().from(pointsRuleConfig).where(eq(pointsRuleConfig.isActive, true));
}

export async function getAllRuleConfig(): Promise<PointsRuleRow[]> {
  const db = getPostgresDb();
  return db.select().from(pointsRuleConfig).orderBy(asc(pointsRuleConfig.eventType));
}

export async function createRuleConfig(input: {
  eventType: string;
  packageId: string | null;
  points: number;
  label: string;
}): Promise<PointsRuleRow> {
  const db = getPostgresDb();
  const [row] = await db.insert(pointsRuleConfig).values(input).returning();
  return row;
}

export async function updateRuleConfig(
  id: string,
  input: Partial<{ points: number; label: string; isActive: boolean; packageId: string | null }>
): Promise<PointsRuleRow | null> {
  const db = getPostgresDb();
  const [row] = await db
    .update(pointsRuleConfig)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(pointsRuleConfig.id, id))
    .returning();
  return row ?? null;
}

export async function getActiveTiers(): Promise<RewardTierRow[]> {
  const db = getPostgresDb();
  return db.select().from(rewardTiers).where(eq(rewardTiers.isActive, true)).orderBy(asc(rewardTiers.sortOrder));
}

export async function getAllTiers(): Promise<RewardTierRow[]> {
  const db = getPostgresDb();
  return db.select().from(rewardTiers).orderBy(asc(rewardTiers.sortOrder));
}

export async function getTierById(id: string): Promise<RewardTierRow | null> {
  const db = getPostgresDb();
  const [row] = await db.select().from(rewardTiers).where(eq(rewardTiers.id, id)).limit(1);
  return row ?? null;
}

export async function createTier(input: {
  minPoints: number;
  maxPoints: number | null;
  costPoints: number;
  bonusMsgPerMonth: number;
  bonusRetentionDays: number;
  bonusMemoryMb: number;
  label: string;
  sortOrder: number;
}): Promise<RewardTierRow> {
  const db = getPostgresDb();
  const [row] = await db.insert(rewardTiers).values(input).returning();
  return row;
}

export async function updateTier(
  id: string,
  input: Partial<{
    minPoints: number;
    maxPoints: number | null;
    costPoints: number;
    bonusMsgPerMonth: number;
    bonusRetentionDays: number;
    bonusMemoryMb: number;
    label: string;
    sortOrder: number;
    isActive: boolean;
  }>
): Promise<RewardTierRow | null> {
  const db = getPostgresDb();
  const [row] = await db.update(rewardTiers).set(input).where(eq(rewardTiers.id, id)).returning();
  return row ?? null;
}

// ── Redemptions ───────────────────────────────────────────────────────

export async function getActiveRedemption(tenantId: string): Promise<{ redemption: ActiveRedemptionRow; tier: RewardTierRow } | null> {
  const db = getPostgresDb();
  const [row] = await db
    .select({ redemption: activeRedemptions, tier: rewardTiers })
    .from(activeRedemptions)
    .innerJoin(rewardTiers, eq(activeRedemptions.tierId, rewardTiers.id))
    .where(and(eq(activeRedemptions.tenantId, tenantId), eq(activeRedemptions.status, "active")))
    .orderBy(desc(activeRedemptions.redeemedAt))
    .limit(1);
  return row ?? null;
}

/** Supersedes any prior active redemption, records the new one, and spends the points. */
export async function redeemTier(input: {
  tenantId: string;
  tierId: string;
  pointsSpent: number;
  cycleStart: Date;
}): Promise<ActiveRedemptionRow> {
  const db = getPostgresDb();

  await db
    .update(activeRedemptions)
    .set({ status: "superseded" })
    .where(and(eq(activeRedemptions.tenantId, input.tenantId), eq(activeRedemptions.status, "active")));

  const [row] = await db
    .insert(activeRedemptions)
    .values({
      tenantId: input.tenantId,
      tierId: input.tierId,
      pointsSpent: input.pointsSpent,
      cycleStart: input.cycleStart,
      status: "active",
    })
    .returning();

  await insertLedgerEntry({
    tenantId: input.tenantId,
    eventType: "redemption",
    points: -input.pointsSpent,
    sourceRefId: input.tierId,
    description: "แลกสิทธิพิเศษ",
  });

  return row;
}

// ── Renewal streaks ───────────────────────────────────────────────────

export async function getRenewalStreak(tenantId: string, scope: string): Promise<RenewalStreakRow | null> {
  const db = getPostgresDb();
  const [row] = await db
    .select()
    .from(renewalStreaks)
    .where(and(eq(renewalStreaks.tenantId, tenantId), eq(renewalStreaks.scope, scope)))
    .limit(1);
  return row ?? null;
}

export async function upsertRenewalStreak(input: {
  tenantId: string;
  scope: string;
  periodEnd: Date;
  streakStartAt: Date;
}): Promise<void> {
  const db = getPostgresDb();
  const existing = await getRenewalStreak(input.tenantId, input.scope);
  if (existing) {
    await db
      .update(renewalStreaks)
      .set({ lastPeriodEnd: input.periodEnd, streakStartAt: input.streakStartAt, updatedAt: new Date() })
      .where(eq(renewalStreaks.id, existing.id));
  } else {
    await db.insert(renewalStreaks).values({
      tenantId: input.tenantId,
      scope: input.scope,
      lastPeriodEnd: input.periodEnd,
      streakStartAt: input.streakStartAt,
    });
  }
}
