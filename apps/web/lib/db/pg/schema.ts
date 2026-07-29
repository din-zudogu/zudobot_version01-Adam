// PostgreSQL (Neon) schema — for new features/modules only.
// Existing data model stays on MongoDB (see lib/db/models/*) — do not
// migrate existing collections here.

import type { AnyPgColumn } from "drizzle-orm/pg-core";
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

// Business category taxonomy for tenant onboarding (top-level category ->
// subcategory tree via parentId). Read-only reference data, seeded via
// scripts/seed-master-data.ts.
export const businessCategories = pgTable("business_categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: varchar("code", { length: 64 }).notNull().unique(),
  nameTh: varchar("name_th", { length: 255 }).notNull(),
  parentId: uuid("parent_id").references(
    (): AnyPgColumn => businessCategories.id,
    { onDelete: "cascade" }
  ),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Signup purpose dropdown options for tenant onboarding.
export const signupPurposes = pgTable("signup_purposes", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: varchar("code", { length: 64 }).notNull().unique(),
  nameTh: varchar("name_th", { length: 255 }).notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
});

// ── Git-connect auto-install ─────────────────────────────────────────────
// Convention for this and future tables: `updatedAt` has defaultNow() for
// INSERT correctness only — Drizzle has no onUpdate trigger, so every
// `.update()` call-site MUST explicitly set `updatedAt: new Date()`.

// One connected source-code repository per tenant (OAuth token or pasted
// AWS IAM keys for CodeCommit). tenantId mirrors Mongo's User._id.toString()
// (same convention as TenantProfileModel.tenantId) — not a Postgres FK,
// since tenants remain canonical in MongoDB.
export const gitConnections = pgTable("git_connections", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: varchar("tenant_id", { length: 64 }).notNull(),
  provider: varchar("provider", { length: 32 }).notNull(), // 'github' | 'gitlab' | 'bitbucket' | 'codecommit'
  authMethod: varchar("auth_method", { length: 16 }).notNull(), // 'oauth' | 'iam_keys' | 'iam_role'

  // Display only (GitHub login, GitLab namespace, Bitbucket workspace, or an
  // AWS account/region label for CodeCommit) — never used for auth.
  accountLabel: varchar("account_label", { length: 255 }),

  // Encrypted via lib/integration/gitTokenCrypto.ts (AES-256-GCM).
  accessTokenEnc: text("access_token_enc"), // OAuth access token, or CodeCommit IAM secret key (authMethod 'iam_keys')
  refreshTokenEnc: text("refresh_token_enc"), // OAuth refresh token (null for CodeCommit)
  tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
  iamAccessKeyIdEnc: text("iam_access_key_id_enc"), // CodeCommit 'iam_keys' only
  awsRegion: varchar("aws_region", { length: 32 }), // CodeCommit only (both auth methods)

  // CodeCommit 'iam_role' only — cross-account AssumeRole, set up via the
  // CloudFormation Quick-Create flow. No long-lived secret ever stored for
  // this method: roleArn is not sensitive (plain text), externalId is
  // encrypted defense-in-depth even though it's not a credential by itself.
  roleArn: text("role_arn"),
  externalIdEnc: text("external_id_enc"),

  repoIdentifier: varchar("repo_identifier", { length: 512 }), // "owner/repo" | GitLab project path | "workspace/repo_slug" | CodeCommit repo name
  repoUrl: text("repo_url"),
  defaultBranch: varchar("default_branch", { length: 255 }).notNull().default("main"),

  status: varchar("status", { length: 24 }).notNull().default("connected"), // 'connected' | 'revoked' | 'error'

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── "บอกต่อ" (Recommend) referral & points program ──────────────────────
// tenantId columns mirror Mongo's User._id.toString() (same convention as
// gitConnections above) — not a Postgres FK, tenants stay canonical in Mongo.

// One row per invite a tenant sends to a friend's email. secretCode is
// embedded in the signup link (?ref=<code>) and must match both the invitee
// email AND the email the recipient actually signs up with — that pairing is
// the "sent to a specific person" verification the spec calls for.
export const referralInvites = pgTable("referral_invites", {
  id: uuid("id").defaultRandom().primaryKey(),
  referrerTenantId: varchar("referrer_tenant_id", { length: 64 }).notNull(),
  inviteeEmail: varchar("invitee_email", { length: 255 }).notNull(),
  secretCode: varchar("secret_code", { length: 64 }).notNull().unique(),
  shopNameHint: varchar("shop_name_hint", { length: 255 }),

  status: varchar("status", { length: 24 }).notNull().default("sent"),
  // 'sent' | 'signed_up' | 'installed' | 'expired'

  referredTenantId: varchar("referred_tenant_id", { length: 64 }),
  signedUpAt: timestamp("signed_up_at", { withTimezone: true }),
  installedAt: timestamp("installed_at", { withTimezone: true }),
  pointsAwarded: boolean("points_awarded").notNull().default(false),

  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Append-only ledger of every point-earning/spending event. Current balance
// for a tenant = SUM(points) WHERE earnedAt >= cycleStart(tenant signup date,
// now) — see computeCycleStart() in lib/referral/pointsEngine.ts. Redemption
// spends are inserted here as negative-point rows.
export const pointsLedger = pgTable("points_ledger", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: varchar("tenant_id", { length: 64 }).notNull(),
  eventType: varchar("event_type", { length: 32 }).notNull(),
  // 'referral' | 'plan_signup' | 'plan_renewal' | 'addon_purchase' | 'addon_renewal' | 'redemption' | 'adjustment'
  points: integer("points").notNull(),

  // Idempotency/audit key — referralInvites.id, Stripe invoice id, rewardTiers.id, etc.
  sourceRefId: varchar("source_ref_id", { length: 128 }),
  description: text("description"),

  earnedAt: timestamp("earned_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Admin master config (spec item 5): how many points each event/plan grants.
// packageId is a free-text label the admin points at whatever real
// PackageConfig/ReadyPackage identifier applies — there is no hardcoded
// mapping from the spec's plan names to catalog IDs.
export const pointsRuleConfig = pgTable("points_rule_config", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventType: varchar("event_type", { length: 32 }).notNull(),
  packageId: varchar("package_id", { length: 128 }),
  points: integer("points").notNull(),
  label: varchar("label", { length: 255 }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Admin master config (spec item 4): point-balance bands -> redeemable reward.
// costPoints is deducted from the tenant's current-cycle balance on redemption.
export const rewardTiers = pgTable("reward_tiers", {
  id: uuid("id").defaultRandom().primaryKey(),
  minPoints: integer("min_points").notNull(),
  maxPoints: integer("max_points"), // null = open-ended top tier
  costPoints: integer("cost_points").notNull(),
  bonusMsgPerMonth: integer("bonus_msg_per_month").notNull().default(0),
  bonusRetentionDays: integer("bonus_retention_days").notNull().default(0),
  bonusMemoryMb: integer("bonus_memory_mb").notNull().default(0),
  label: varchar("label", { length: 255 }).notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Which reward tier is currently active per tenant. Redeeming a new tier
// supersedes the previous 'active' row; resets alongside the annual points cycle.
export const activeRedemptions = pgTable("active_redemptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: varchar("tenant_id", { length: 64 }).notNull(),
  tierId: uuid("tier_id").notNull().references((): AnyPgColumn => rewardTiers.id),
  pointsSpent: integer("points_spent").notNull(),
  redeemedAt: timestamp("redeemed_at", { withTimezone: true }).notNull().defaultNow(),
  cycleStart: timestamp("cycle_start", { withTimezone: true }).notNull(),
  status: varchar("status", { length: 16 }).notNull().default("active"), // 'active' | 'superseded' | 'expired'
});

// Continuous-renewal streak tracking (spec items 5.4/5.6/5.8/7) — a gap of
// >=1 month between lastPeriodEnd and the next period's start resets the
// streak, i.e. the next payment is scored as a fresh 'signup', not 'renewal'.
export const renewalStreaks = pgTable("renewal_streaks", {
  id: uuid("id").defaultRandom().primaryKey(),
  tenantId: varchar("tenant_id", { length: 64 }).notNull(),
  scope: varchar("scope", { length: 32 }).notNull(),
  // 'plan' | 'quota_addon' | 'memory_addon' | 'retention_addon'
  lastPeriodEnd: timestamp("last_period_end", { withTimezone: true }).notNull(),
  streakStartAt: timestamp("streak_start_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// One row per auto-install attempt. Resumable across cron worker ticks —
// agentTranscript checkpoints the Claude tool-use loop so a run can continue
// from where it left off if a single cron invocation's time budget runs out.
export const gitInstallJobs = pgTable("git_install_jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  connectionId: uuid("connection_id")
    .notNull()
    .references((): AnyPgColumn => gitConnections.id, { onDelete: "cascade" }),
  tenantId: varchar("tenant_id", { length: 64 }).notNull(), // denormalized for direct dashboard queries w/o join

  status: varchar("status", { length: 24 }).notNull().default("pending"),
  // 'pending' | 'analyzing' | 'pr_open' | 'live' | 'failed'

  branchName: varchar("branch_name", { length: 255 }),
  pullRequestId: varchar("pull_request_id", { length: 128 }), // provider's PR/MR IID, needed for the merge call
  pullRequestUrl: text("pull_request_url"),
  targetFilePath: text("target_file_path"), // file the agent edited — audit/debug only

  errorMessage: text("error_message"),

  agentTranscript: jsonb("agent_transcript"), // Anthropic message[] checkpoint
  agentTurnCount: integer("agent_turn_count").notNull().default(0),
  agentTokensUsed: integer("agent_tokens_used").notNull().default(0),

  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
