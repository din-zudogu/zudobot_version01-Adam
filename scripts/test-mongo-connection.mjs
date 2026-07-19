/**
 * Test MongoDB using MONGO_URI from AWS Amplify only.
 */

import { loadMongoEnv, getMongoEnvSummary, connectMongoClient } from "./lib/mongo-connect.mjs";

console.log("==== MongoDB connection test (AWS Amplify env) ====\n");

let meta;
try {
  meta = await loadMongoEnv();
  console.log(`Env source: ${meta.source} | branch: ${meta.branch} | app: ${meta.appId}\n`);
} catch (err) {
  console.error("❌", err.message);
  process.exit(1);
}

const summary = getMongoEnvSummary();
if (!summary.ok) {
  console.error("❌", summary.error);
  process.exit(1);
}

console.log("Mongo (from Amplify):");
console.log(`  user            : ${summary.user}`);
console.log(`  password length : ${summary.passwordLength} chars`);
console.log(`  SRV host        : ${summary.srvHost ?? "(not set)"}`);
console.log(`  DIRECT host     : ${summary.directHost ?? "(not set)"}\n`);

try {
  const { client, mode } = await connectMongoClient();
  const dbName = process.env.MONGO_DB_NAME || "zudobot_saas";
  const db = client.db(dbName);
  const users = await db.collection("users").countDocuments();
  const official = await db.collection("users").findOne(
    { email: "zudogu.official@gmail.com" },
    { projection: { email: 1, role: 1 } }
  );
  console.log(`✅ Connected via ${mode}`);
  console.log(`   database         : ${dbName}`);
  console.log(`   users collection : ${users} documents`);
  console.log(
    `   whitelist        : ${official ? `${official.email} (${official.role})` : "NOT FOUND"}`
  );
  await client.close();
} catch (err) {
  console.error("❌", err.message);
  process.exit(1);
}
