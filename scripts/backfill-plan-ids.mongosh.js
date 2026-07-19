// Run this in MongoDB Atlas → your cluster → Browse Collections → "> _MONGOSH" tab
// Or: Atlas → Clusters → Connect → Shell

const col = db.getSiblingDB("zudobot_saas").getCollection("costpricescenarios");

const docs = col.find({ plan_id: { $exists: false } }, { _id: 1 }).toArray();
print(`Found ${docs.length} docs without plan_id`);

if (docs.length === 0) { print("Nothing to do."); quit(); }

const usedIds = new Set();

function randomPlanId() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function generateUnique() {
  for (let i = 0; i < 20; i++) {
    const id = randomPlanId();
    if (usedIds.has(id)) continue;
    if (!col.findOne({ plan_id: id })) { usedIds.add(id); return id; }
  }
  throw new Error("plan_id_generation_failed");
}

let updated = 0;
for (const doc of docs) {
  const plan_id = generateUnique();
  col.updateOne({ _id: doc._id }, { $set: { plan_id } });
  print(`  ${doc._id} → ${plan_id}`);
  updated++;
}

print(`\nDone — updated ${updated} docs.`);
