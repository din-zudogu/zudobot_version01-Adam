/**
 * Seed business_categories and signup_purposes (Postgres/Neon).
 * Run: node scripts/seed-master-data.mjs
 *  (from apps/web directory, with DATABASE_URL set in process.env)
 */
import { neon } from "@neondatabase/serverless";
import { BUSINESS_CATEGORIES, SIGNUP_PURPOSES } from "./data/businessCategories.mjs";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set.");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function upsertCategory(code, nameTh, parentId, sortOrder) {
  const rows = await sql`
    INSERT INTO business_categories (code, name_th, parent_id, sort_order, is_active)
    VALUES (${code}, ${nameTh}, ${parentId}, ${sortOrder}, true)
    ON CONFLICT (code) DO UPDATE
      SET name_th = EXCLUDED.name_th,
          parent_id = EXCLUDED.parent_id,
          sort_order = EXCLUDED.sort_order,
          is_active = true
    RETURNING id
  `;
  return rows[0].id;
}

async function upsertPurpose(code, nameTh, sortOrder) {
  await sql`
    INSERT INTO signup_purposes (code, name_th, sort_order, is_active)
    VALUES (${code}, ${nameTh}, ${sortOrder}, true)
    ON CONFLICT (code) DO UPDATE
      SET name_th = EXCLUDED.name_th,
          sort_order = EXCLUDED.sort_order,
          is_active = true
  `;
}

async function main() {
  let categoryCount = 0;
  let subcategoryCount = 0;

  for (let i = 0; i < BUSINESS_CATEGORIES.length; i++) {
    const cat = BUSINESS_CATEGORIES[i];
    const parentId = await upsertCategory(cat.code, cat.nameTh, null, (i + 1) * 10);
    categoryCount++;
    console.log(`category   ${cat.code}`);

    for (let j = 0; j < cat.children.length; j++) {
      const child = cat.children[j];
      await upsertCategory(child.code, child.nameTh, parentId, (j + 1) * 10);
      subcategoryCount++;
    }
  }

  let purposeCount = 0;
  for (let i = 0; i < SIGNUP_PURPOSES.length; i++) {
    const p = SIGNUP_PURPOSES[i];
    await upsertPurpose(p.code, p.nameTh, (i + 1) * 10);
    purposeCount++;
    console.log(`purpose    ${p.code}`);
  }

  const totalTopLevel = await sql`SELECT count(*)::int AS n FROM business_categories WHERE parent_id IS NULL`;
  const totalSub = await sql`SELECT count(*)::int AS n FROM business_categories WHERE parent_id IS NOT NULL`;
  const totalPurposes = await sql`SELECT count(*)::int AS n FROM signup_purposes`;

  console.log("\n================================");
  console.log(`Top-level categories : ${categoryCount} (${totalTopLevel[0].n} in DB)`);
  console.log(`Subcategories        : ${subcategoryCount} (${totalSub[0].n} in DB)`);
  console.log(`Signup purposes      : ${purposeCount} (${totalPurposes[0].n} in DB)`);
  console.log("================================");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
