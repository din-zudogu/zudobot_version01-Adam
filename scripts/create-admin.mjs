/**
 * Zudobot — Create Super Admin User
 * Usage: node scripts/create-admin.mjs
 */

import mongoose from "mongoose";
import { connectMongoose, loadMongoEnv } from "./lib/mongo-connect.mjs";

console.log("🔌  Loading env from AWS Amplify…");
const meta = await loadMongoEnv();
console.log(`   ${meta.source} | branch ${meta.branch}`);
await connectMongoose();
console.log("✅  MongoDB connected");

const UserSchema = new mongoose.Schema({
  email:              { type: String, unique: true },
  name:               String,
  googleId:           String,
  image:              String,
  role:               { type: String, default: "tenant" },
  tenantId:           String,
  botState:           { type: String, default: "trial" },
  trialEndsAt:        Date,
  onboardingComplete: { type: Boolean, default: false },
}, { timestamps: true });

const User = mongoose.models.User || mongoose.model("User", UserSchema, "users");

// ── Config ────────────────────────────────────────────────────────────────────
const ADMIN_EMAIL = "zudogu.official@gmail.com";
const ADMIN_NAME  = "Admin Zudobot";
// ─────────────────────────────────────────────────────────────────────────────

const existing = await User.findOne({ email: ADMIN_EMAIL.toLowerCase() });

if (existing) {
  await User.findByIdAndUpdate(existing._id, {
    role:               "super_admin",
    onboardingComplete: true,
    tenantId:           existing._id.toString(),
  });
  console.log("\n✅  User already exists — updated to super_admin\n");
  console.log(`   Email : ${ADMIN_EMAIL}`);
  console.log(`   Role  : super_admin`);
  console.log(`   ID    : ${existing._id}`);
} else {
  const newUser = await User.create({
    email:              ADMIN_EMAIL.toLowerCase(),
    name:               ADMIN_NAME,
    role:               "super_admin",
    botState:           "active",
    onboardingComplete: true,
  });
  await User.findByIdAndUpdate(newUser._id, { tenantId: newUser._id.toString() });

  console.log("\n🎉  Super admin created!\n");
  console.log(`   Email : ${ADMIN_EMAIL}`);
  console.log(`   Role  : super_admin`);
  console.log(`   ID    : ${newUser._id}`);
}

console.log("\n👉  Login: https://zudobot.zudogu.com/login");
console.log("   Sign in with Google using the admin Gmail account\n");

await mongoose.disconnect();
