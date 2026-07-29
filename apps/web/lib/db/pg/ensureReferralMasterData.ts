/**
 * Lazily creates the "บอกต่อ" referral/points tables and seeds
 * points_rule_config / reward_tiers at runtime, using the app's own live
 * DATABASE_URL — same self-provisioning rationale as ensureMasterData.ts:
 * a fresh environment shouldn't 500 with "relation does not exist" just
 * because `drizzle-kit migrate` wasn't run as a manual deploy step.
 *
 * Transactional tables (referral_invites, points_ledger, active_redemptions,
 * renewal_streaks) are also created here IF NOT EXISTS so the whole feature
 * self-heals; points_rule_config/reward_tiers are additionally seeded with
 * defaults on first run only (admins edit them afterward via the admin UI).
 */
import { sql } from "drizzle-orm";
import { getPostgresDb } from "@/lib/db/postgres";
import { POINTS_RULES, REWARD_TIERS } from "./referralMasterDataSeed";

let ensured = false;
let ensuring: Promise<void> | null = null;

async function doEnsure(): Promise<void> {
  const db = getPostgresDb();

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS referral_invites (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      referrer_tenant_id varchar(64) NOT NULL,
      invitee_email varchar(255) NOT NULL,
      secret_code varchar(64) NOT NULL UNIQUE,
      shop_name_hint varchar(255),
      status varchar(24) NOT NULL DEFAULT 'sent',
      referred_tenant_id varchar(64),
      signed_up_at timestamptz,
      installed_at timestamptz,
      points_awarded boolean NOT NULL DEFAULT false,
      expires_at timestamptz NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS referral_invites_referrer_idx ON referral_invites (referrer_tenant_id)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS referral_invites_referred_idx ON referral_invites (referred_tenant_id)`);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS points_ledger (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id varchar(64) NOT NULL,
      event_type varchar(32) NOT NULL,
      points integer NOT NULL,
      source_ref_id varchar(128),
      description text,
      earned_at timestamptz NOT NULL DEFAULT now(),
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS points_ledger_tenant_idx ON points_ledger (tenant_id, earned_at)`);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS points_rule_config (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      event_type varchar(32) NOT NULL,
      package_id varchar(128),
      points integer NOT NULL,
      label varchar(255) NOT NULL,
      is_active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS reward_tiers (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      min_points integer NOT NULL,
      max_points integer,
      cost_points integer NOT NULL,
      bonus_msg_per_month integer NOT NULL DEFAULT 0,
      bonus_retention_days integer NOT NULL DEFAULT 0,
      bonus_memory_mb integer NOT NULL DEFAULT 0,
      label varchar(255) NOT NULL,
      sort_order integer NOT NULL DEFAULT 0,
      is_active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS active_redemptions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id varchar(64) NOT NULL,
      tier_id uuid NOT NULL REFERENCES reward_tiers(id),
      points_spent integer NOT NULL,
      redeemed_at timestamptz NOT NULL DEFAULT now(),
      cycle_start timestamptz NOT NULL,
      status varchar(16) NOT NULL DEFAULT 'active'
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS active_redemptions_tenant_idx ON active_redemptions (tenant_id, status)`);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS renewal_streaks (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id varchar(64) NOT NULL,
      scope varchar(32) NOT NULL,
      last_period_end timestamptz NOT NULL,
      streak_start_at timestamptz NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS renewal_streaks_tenant_scope_idx ON renewal_streaks (tenant_id, scope)`);

  const ruleCountRows = await db.execute(sql`SELECT count(*)::int AS count FROM points_rule_config`);
  const ruleCount = (ruleCountRows as unknown as { rows: { count: number }[] }).rows[0].count;
  if (ruleCount === 0) {
    for (const rule of POINTS_RULES) {
      await db.execute(sql`
        INSERT INTO points_rule_config (event_type, package_id, points, label, is_active)
        VALUES (${rule.eventType}, ${rule.packageId}, ${rule.points}, ${rule.label}, true)
      `);
    }
  }

  const tierCountRows = await db.execute(sql`SELECT count(*)::int AS count FROM reward_tiers`);
  const tierCount = (tierCountRows as unknown as { rows: { count: number }[] }).rows[0].count;
  if (tierCount === 0) {
    for (const tier of REWARD_TIERS) {
      await db.execute(sql`
        INSERT INTO reward_tiers (min_points, max_points, cost_points, bonus_msg_per_month, bonus_retention_days, bonus_memory_mb, label, sort_order, is_active)
        VALUES (${tier.minPoints}, ${tier.maxPoints}, ${tier.costPoints}, ${tier.bonusMsgPerMonth}, ${tier.bonusRetentionDays}, ${tier.bonusMemoryMb}, ${tier.label}, ${tier.sortOrder}, true)
      `);
    }
  }
}

/**
 * Ensure all referral/points tables exist and rule/tier master data is
 * seeded. Safe to call on every request — no-ops after the first successful
 * run in this warm instance, race-safe across concurrent cold starts thanks
 * to `IF NOT EXISTS` on tables/indexes.
 */
export async function ensureReferralMasterData(): Promise<void> {
  if (ensured) return;
  if (!ensuring) {
    ensuring = doEnsure()
      .then(() => {
        ensured = true;
      })
      .finally(() => {
        ensuring = null;
      });
  }
  return ensuring;
}
