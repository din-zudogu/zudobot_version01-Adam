/**
 * Usage: node scripts/check-user.mjs <email>
 */
import mongoose from "mongoose";
import { connectMongoose, loadMongoEnv } from "./lib/mongo-connect.mjs";

const meta = await loadMongoEnv();
console.log(`Amplify env: ${meta.source} (${meta.branch})\n`);
await connectMongoose();

const User = mongoose.model("User", new mongoose.Schema({
  email: String, name: String, googleId: String,
  role: String, botState: String, onboardingComplete: Boolean,
  trialEndsAt: Date, createdAt: Date,
}, { timestamps: true }), "users");

const email = process.argv[2]?.toLowerCase();
if (!email) { console.error("Usage: node scripts/check-user.mjs <email>"); process.exit(1); }

const user = await User.findOne({ email });

if (!user) {
  console.log(`\n❌  ไม่พบ user: ${email}\n`);
} else {
  console.log(`\n✅  พบ user:\n`);
  console.log(`   ID               : ${user._id}`);
  console.log(`   Email            : ${user.email}`);
  console.log(`   Name             : ${user.name}`);
  console.log(`   Role             : ${user.role}`);
  console.log(`   botState         : ${user.botState}`);
  console.log(`   googleId         : ${user.googleId ?? "(ไม่มี — สมัครด้วย email/password)"}`);
  console.log(`   onboardingComplete: ${user.onboardingComplete}`);
  console.log(`   trialEndsAt      : ${user.trialEndsAt ?? "-"}`);
  console.log(`   createdAt        : ${user.createdAt}\n`);
}

await mongoose.disconnect();
