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
