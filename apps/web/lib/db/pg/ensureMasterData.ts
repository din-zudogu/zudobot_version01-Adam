/**
 * Lazily creates + seeds the business_categories / signup_purposes tables at
 * runtime, using the app's own live DATABASE_URL (AMPLIFY_CONFIG.databaseUrl).
 *
 * This exists because `drizzle-kit migrate` + scripts/seed-master-data.mjs
 * require someone to run them manually with a valid DATABASE_URL — which is
 * an extra deploy step that's easy to forget. Calling this once (idempotent,
 * cached per warm instance) from every route that reads this master data
 * means a fresh environment self-provisions on its first real request
 * instead of returning empty dropdowns or crashing with "relation does not
 * exist".
 */
import { sql } from "drizzle-orm";
import { getPostgresDb } from "@/lib/db/postgres";
import { BUSINESS_CATEGORIES, SIGNUP_PURPOSES } from "./masterDataSeed";

let ensured = false;
let ensuring: Promise<void> | null = null;

async function upsertCategory(
  db: ReturnType<typeof getPostgresDb>,
  code: string,
  nameTh: string,
  parentId: string | null,
  sortOrder: number
): Promise<string> {
  const rows = await db.execute(sql`
    INSERT INTO business_categories (code, name_th, parent_id, sort_order, is_active)
    VALUES (${code}, ${nameTh}, ${parentId}, ${sortOrder}, true)
    ON CONFLICT (code) DO UPDATE
      SET name_th = EXCLUDED.name_th,
          parent_id = EXCLUDED.parent_id,
          sort_order = EXCLUDED.sort_order,
          is_active = true
    RETURNING id
  `);
  return (rows as unknown as { rows: { id: string }[] }).rows[0].id;
}

async function upsertPurpose(
  db: ReturnType<typeof getPostgresDb>,
  code: string,
  nameTh: string,
  sortOrder: number
): Promise<void> {
  await db.execute(sql`
    INSERT INTO signup_purposes (code, name_th, sort_order, is_active)
    VALUES (${code}, ${nameTh}, ${sortOrder}, true)
    ON CONFLICT (code) DO UPDATE
      SET name_th = EXCLUDED.name_th,
          sort_order = EXCLUDED.sort_order,
          is_active = true
  `);
}

async function doEnsure(): Promise<void> {
  const db = getPostgresDb();

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS business_categories (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      code varchar(64) NOT NULL UNIQUE,
      name_th varchar(255) NOT NULL,
      parent_id uuid REFERENCES business_categories(id) ON DELETE CASCADE,
      sort_order integer NOT NULL DEFAULT 0,
      is_active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS signup_purposes (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      code varchar(64) NOT NULL UNIQUE,
      name_th varchar(255) NOT NULL,
      sort_order integer NOT NULL DEFAULT 0,
      is_active boolean NOT NULL DEFAULT true
    )
  `);

  const countRows = await db.execute(sql`SELECT count(*)::int AS count FROM business_categories`);
  const categoryCount = (countRows as unknown as { rows: { count: number }[] }).rows[0].count;

  if (categoryCount === 0) {
    for (let i = 0; i < BUSINESS_CATEGORIES.length; i++) {
      const cat = BUSINESS_CATEGORIES[i];
      const parentId = await upsertCategory(db, cat.code, cat.nameTh, null, (i + 1) * 10);
      for (let j = 0; j < cat.children.length; j++) {
        const child = cat.children[j];
        await upsertCategory(db, child.code, child.nameTh, parentId, (j + 1) * 10);
      }
    }
  }

  const purposeCountRows = await db.execute(sql`SELECT count(*)::int AS count FROM signup_purposes`);
  const purposeCount = (purposeCountRows as unknown as { rows: { count: number }[] }).rows[0].count;

  if (purposeCount === 0) {
    for (let i = 0; i < SIGNUP_PURPOSES.length; i++) {
      const p = SIGNUP_PURPOSES[i];
      await upsertPurpose(db, p.code, p.nameTh, (i + 1) * 10);
    }
  }
}

/**
 * Ensure business_categories/signup_purposes exist and are populated.
 * Safe to call on every request — no-ops after the first successful run in
 * this warm instance, and is race-safe across concurrent cold starts thanks
 * to `IF NOT EXISTS` + `ON CONFLICT DO UPDATE`.
 */
export async function ensureMasterData(): Promise<void> {
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
