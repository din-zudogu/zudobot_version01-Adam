CREATE TABLE "business_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(64) NOT NULL,
	"name_th" varchar(255) NOT NULL,
	"parent_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "business_categories_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "signup_purposes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(64) NOT NULL,
	"name_th" varchar(255) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "signup_purposes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "business_categories" ADD CONSTRAINT "business_categories_parent_id_business_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."business_categories"("id") ON DELETE cascade ON UPDATE no action;