/**
 * One-time migration: assign plan_id to all CostPriceScenario docs that don't have one.
 *
 * Requires AWS IAM credentials in .env.aws.local (repo root) to load MONGO_URI from Amplify.
 * Run once after deploy: node scripts/backfill-plan-ids.mjs
 */

import { connectMongoClient } from "./lib/mongo-connect.mjs";

const COLLECTION = "costpricescenarios";

function randomPlanId() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function generateUnique(col, usedIds) {
  for (let i = 0; i < 20; i++) {
    const id = randomPlanId();
    if (usedIds.has(id)) continue;
    const existing = await col.findOne({ plan_id: id });
    if (!existing) { usedIds.add(id); return id; }
  }
  throw new Error("plan_id_generation_failed after 20 retries");
}

const { client } = await connectMongoClient();
const col = client.db(process.env.MONGO_DB_NAME || "zudobot_saas").collection(COLLECTION);

const docs = await col.find({ plan_id: { $exists: false } }, { projection: { _id: 1 } }).toArray();
console.log(`Found ${docs.length} docs without plan_id`);

if (docs.length === 0) {
  console.log("Nothing to do.");
  await client.close();
  process.exit(0);
}

const usedIds = new Set();
let updated = 0;

for (const doc of docs) {
  const plan_id = await generateUnique(col, usedIds);
  await col.updateOne({ _id: doc._id }, { $set: { plan_id } });
  console.log(`  ${doc._id} → ${plan_id}`);
  updated++;
}

console.log(`\nDone — updated ${updated} docs.`);
await client.close();
