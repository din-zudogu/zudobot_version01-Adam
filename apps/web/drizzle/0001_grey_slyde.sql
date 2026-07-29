CREATE TABLE "active_redemptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"tier_id" uuid NOT NULL,
	"points_spent" integer NOT NULL,
	"redeemed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cycle_start" timestamp with time zone NOT NULL,
	"status" varchar(16) DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "git_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"provider" varchar(32) NOT NULL,
	"auth_method" varchar(16) NOT NULL,
	"account_label" varchar(255),
	"access_token_enc" text,
	"refresh_token_enc" text,
	"token_expires_at" timestamp with time zone,
	"iam_access_key_id_enc" text,
	"aws_region" varchar(32),
	"role_arn" text,
	"external_id_enc" text,
	"repo_identifier" varchar(512),
	"repo_url" text,
	"default_branch" varchar(255) DEFAULT 'main' NOT NULL,
	"status" varchar(24) DEFAULT 'connected' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "git_install_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connection_id" uuid NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"status" varchar(24) DEFAULT 'pending' NOT NULL,
	"branch_name" varchar(255),
	"pull_request_id" varchar(128),
	"pull_request_url" text,
	"target_file_path" text,
	"error_message" text,
	"agent_transcript" jsonb,
	"agent_turn_count" integer DEFAULT 0 NOT NULL,
	"agent_tokens_used" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "points_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"event_type" varchar(32) NOT NULL,
	"points" integer NOT NULL,
	"source_ref_id" varchar(128),
	"description" text,
	"earned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "points_rule_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_type" varchar(32) NOT NULL,
	"package_id" varchar(128),
	"points" integer NOT NULL,
	"label" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referral_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"referrer_tenant_id" varchar(64) NOT NULL,
	"invitee_email" varchar(255) NOT NULL,
	"secret_code" varchar(64) NOT NULL,
	"shop_name_hint" varchar(255),
	"status" varchar(24) DEFAULT 'sent' NOT NULL,
	"referred_tenant_id" varchar(64),
	"signed_up_at" timestamp with time zone,
	"installed_at" timestamp with time zone,
	"points_awarded" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "referral_invites_secret_code_unique" UNIQUE("secret_code")
);
--> statement-breakpoint
CREATE TABLE "renewal_streaks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"scope" varchar(32) NOT NULL,
	"last_period_end" timestamp with time zone NOT NULL,
	"streak_start_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reward_tiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"min_points" integer NOT NULL,
	"max_points" integer,
	"cost_points" integer NOT NULL,
	"bonus_msg_per_month" integer DEFAULT 0 NOT NULL,
	"bonus_retention_days" integer DEFAULT 0 NOT NULL,
	"bonus_memory_mb" integer DEFAULT 0 NOT NULL,
	"label" varchar(255) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "active_redemptions" ADD CONSTRAINT "active_redemptions_tier_id_reward_tiers_id_fk" FOREIGN KEY ("tier_id") REFERENCES "public"."reward_tiers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "git_install_jobs" ADD CONSTRAINT "git_install_jobs_connection_id_git_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."git_connections"("id") ON DELETE cascade ON UPDATE no action;