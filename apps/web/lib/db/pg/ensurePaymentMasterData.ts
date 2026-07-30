/**
 * Lazily creates the tenant "Payment Methods" tables at runtime, using the
 * app's own live DATABASE_URL — same self-provisioning rationale as
 * ensureMasterData.ts / ensureReferralMasterData.ts: a fresh environment
 * shouldn't 500 with "relation does not exist" just because `drizzle-kit
 * migrate` wasn't run as a manual deploy step. No seed data here — these are
 * transactional tables, not admin-editable master config.
 */
import { sql } from "drizzle-orm";
import { getPostgresDb } from "@/lib/db/postgres";

let ensured = false;
let ensuring: Promise<void> | null = null;

async function doEnsure(): Promise<void> {
  const db = getPostgresDb();

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS payment_method_config (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id varchar(64) NOT NULL UNIQUE,
      promptpay_id varchar(32),
      promptpay_enabled boolean NOT NULL DEFAULT false,
      bank_name varchar(128),
      bank_account_number varchar(32),
      bank_account_name varchar(255),
      bank_transfer_enabled boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS payment_trans (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id varchar(64) NOT NULL,
      amount_thb numeric(12,2) NOT NULL,
      method varchar(24) NOT NULL,
      session_id varchar(128),
      slip_s3_key text,
      verification_method varchar(24) NOT NULL DEFAULT 'gemini_vision',
      confidence double precision,
      extracted_bank_name varchar(128),
      extracted_ref varchar(128),
      extracted_datetime varchar(64),
      status varchar(24) NOT NULL DEFAULT 'pending_review',
      reviewed_by varchar(64),
      reviewed_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS payment_trans_tenant_idx ON payment_trans (tenant_id, created_at)`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS payment_trans_status_idx ON payment_trans (tenant_id, status)`);

  await db.execute(sql`CREATE INDEX IF NOT EXISTS payment_method_config_tenant_idx ON payment_method_config (tenant_id)`);
}

/**
 * Ensure payment_method_config/payment_trans exist. Safe to call on every
 * request — no-ops after the first successful run in this warm instance,
 * race-safe across concurrent cold starts thanks to `IF NOT EXISTS`.
 */
export async function ensurePaymentMasterData(): Promise<void> {
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
