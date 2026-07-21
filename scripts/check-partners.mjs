/**
 * Read-only diagnostic: how many PartnerProfile docs actually exist in the DB,
 * and whether the admin list query (deletedAt: { $exists: false }) is excluding any.
 * Usage: node scripts/check-partners.mjs
 */
import mongoose from "mongoose";
import { connectMongoose, loadMongoEnv } from "./lib/mongo-connect.mjs";

const meta = await loadMongoEnv();
console.log(`Amplify env: ${meta.source} (${meta.branch})\n`);
await connectMongoose();

const PartnerProfile = mongoose.model("PartnerProfile", new mongoose.Schema({
  userId: String, companyName: String, email: String, status: String,
  isStripeConnected: Boolean, totalActiveSlots: Number, totalEarningsThb: Number,
  deletedAt: Date, pendingDeleteAt: Date, createdAt: Date,
}, { timestamps: true }), "partnerprofiles");

const totalAll        = await PartnerProfile.countDocuments({});
const totalNotDeleted = await PartnerProfile.countDocuments({ deletedAt: { $exists: false } });
const totalDeleted    = await PartnerProfile.countDocuments({ deletedAt: { $exists: true } });

console.log(`Total PartnerProfile docs (all)         : ${totalAll}`);
console.log(`Matching admin list filter (not deleted): ${totalNotDeleted}`);
console.log(`Soft-deleted (deletedAt set)             : ${totalDeleted}\n`);

if (totalAll > 0) {
  const sample = await PartnerProfile.find({}).sort({ createdAt: -1 }).limit(10)
    .select("companyName email status deletedAt pendingDeleteAt createdAt").lean();
  console.log("Sample (newest 10):");
  for (const p of sample) {
    console.log(`  - ${p.companyName} <${p.email}> status=${p.status} deletedAt=${p.deletedAt ?? "-"} pendingDeleteAt=${p.pendingDeleteAt ?? "-"} createdAt=${p.createdAt}`);
  }
}

const User = mongoose.model("User", new mongoose.Schema({
  email: String, name: String, role: String, createdAt: Date,
}, { timestamps: true }), "users");
const partnerAdmins = await User.countDocuments({ role: "partner_admin" });
console.log(`\npartner_admin User docs (incl. orphaned): ${partnerAdmins}`);

await mongoose.disconnect();
