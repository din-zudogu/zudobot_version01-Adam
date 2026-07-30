CREATE TABLE "payment_method_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"promptpay_id" varchar(32),
	"promptpay_enabled" boolean DEFAULT false NOT NULL,
	"bank_name" varchar(128),
	"bank_account_number" varchar(32),
	"bank_account_name" varchar(255),
	"bank_transfer_enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_method_config_tenant_id_unique" UNIQUE("tenant_id")
);
--> statement-breakpoint
CREATE TABLE "payment_trans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar(64) NOT NULL,
	"amount_thb" numeric(12, 2) NOT NULL,
	"method" varchar(24) NOT NULL,
	"session_id" varchar(128),
	"slip_s3_key" text,
	"verification_method" varchar(24) DEFAULT 'gemini_vision' NOT NULL,
	"confidence" double precision,
	"extracted_bank_name" varchar(128),
	"extracted_ref" varchar(128),
	"extracted_datetime" varchar(64),
	"status" varchar(24) DEFAULT 'pending_review' NOT NULL,
	"reviewed_by" varchar(64),
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
