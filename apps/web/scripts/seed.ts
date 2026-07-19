/**
 * Seed script — run once to create admin + demo accounts
 * Usage: npx tsx scripts/seed.ts
 */
import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) throw new Error("MONGO_URI not set in .env.local");

// Inline minimal schemas to avoid module resolution issues in standalone script
const UserSchema = new mongoose.Schema(
  {
    email:        { type: String, required: true, unique: true, lowercase: true },
    name:         { type: String, required: true },
    passwordHash: { type: String },
    role:         { type: String, enum: ["super_admin","admin","tenant"], default: "tenant" },
    tenantId:     { type: String },
    botState:     { type: String, default: "trial" },
    trialEndsAt:  { type: Date },
    onboardingComplete: { type: Boolean, default: false },
  },
  { timestamps: true }
);
const UserModel = mongoose.models.User ?? mongoose.model("User", UserSchema);

const TenantProfileSchema = new mongoose.Schema(
  {
    tenantId:     { type: String, required: true, unique: true },
    businessName: { type: String, required: true },
    businessType: { type: String, default: "software" },
    botName:      { type: String, default: "Zudobot Demo" },
    botGender:    { type: String, enum: ["female", "male"], default: "female" },
    botTone:      { type: String, default: "friendly" },
    welcomeMessage: { type: String, default: "สวัสดีครับ ยินดีต้อนรับ!" },
    widgetColor:    { type: String, default: "#1E5BC6" },
    widgetPosition: { type: String, default: "bottom-right" },
    widgetEnabled:  { type: Boolean, default: true },
    embedKey:       { type: String, required: true },
    trialStartedAt: { type: Date, default: () => new Date() },
    dailyMessageCount:   { type: Number, default: 0 },
    dailyMessageResetAt: { type: Date, default: () => new Date() },
    totalMessageCount:   { type: Number, default: 0 },
  },
  { timestamps: true }
);
const TenantProfileModel =
  mongoose.models.TenantProfile ?? mongoose.model("TenantProfile", TenantProfileSchema);

async function seed() {
  await mongoose.connect(MONGO_URI as string, { dbName: "zudobot_saas" });
  console.log("✅ Connected to MongoDB");

  // ── 1. super_admin ──────────────────────────────────────────────
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@zudogu.com";
  const adminPass  = process.env.SEED_ADMIN_PASSWORD ?? "Admin@Zudobot2025!";

  const adminExists = await UserModel.findOne({ email: adminEmail });
  if (adminExists) {
    console.log(`⚠️  Admin already exists: ${adminEmail}`);
  } else {
    const hash = await bcrypt.hash(adminPass, 12);
    const admin = await UserModel.create({
      email: adminEmail,
      name:  "Super Admin",
      passwordHash: hash,
      role:  "super_admin",
      onboardingComplete: true,
    });
    await UserModel.findByIdAndUpdate(admin._id, { tenantId: admin._id.toString() });
    console.log(`✅ Created super_admin: ${adminEmail}`);
  }

  // ── 2. demo tenant ──────────────────────────────────────────────
  const demoEmail = process.env.SEED_DEMO_EMAIL ?? "demo@zudobot.zudogu.com";
  const demoPass  = process.env.SEED_DEMO_PASSWORD ?? "Demo@Zudobot2025!";

  const demoExists = await UserModel.findOne({ email: demoEmail });
  if (demoExists) {
    console.log(`⚠️  Demo tenant already exists: ${demoEmail}`);
  } else {
    const hash = await bcrypt.hash(demoPass, 12);
    const demo = await UserModel.create({
      email: demoEmail,
      name:  "Zudobot Demo",
      passwordHash: hash,
      role:         "tenant",
      botState:     "trial",
      trialEndsAt:  new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1-year demo
      onboardingComplete: true,
    });
    const tenantId = demo._id.toString();
    await UserModel.findByIdAndUpdate(demo._id, { tenantId });

    await TenantProfileModel.create({
      tenantId,
      businessName: "Zudobot Demo Store",
      businessType: "software",
      botName:      "Aria",
      botGender:    "female",
      botTone:      "friendly",
      welcomeMessage: "สวัสดีค่ะ! ดิฉัน Aria AI Sales Agent ตัวอย่าง มีอะไรให้ช่วยไหมคะ? 😊",
      widgetColor:    "#1E5BC6",
      widgetPosition: "bottom-right",
      widgetEnabled:  true,
      embedKey:       "demo_" + tenantId.slice(0, 12),
      trialStartedAt: new Date(),
    });
    console.log(`✅ Created demo tenant: ${demoEmail}`);
  }

  await mongoose.disconnect();
  console.log("✅ Seed complete. Disconnected.");
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
