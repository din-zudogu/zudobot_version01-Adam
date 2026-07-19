/**
 * Cleanup script — ลบ User records ที่ไม่สมบูรณ์ (onboardingComplete: false)
 * เกิดจากระบบเก่าก่อนที่จะใช้ Deferred User Creation (C-path)
 *
 * Usage: npx tsx scripts/cleanup-pending-users.ts
 * ต้องมี MONGO_URI ใน .env.local
 */
import "dotenv/config";
import mongoose from "mongoose";

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) throw new Error("MONGO_URI not set in .env.local");

const UserSchema = new mongoose.Schema(
  {
    email:              { type: String, required: true, unique: true, lowercase: true },
    name:               { type: String },
    role:               { type: String },
    onboardingComplete: { type: Boolean, default: false },
    tenantId:           { type: String },
  },
  { timestamps: true }
);

const TenantProfileSchema = new mongoose.Schema(
  { tenantId: { type: String, required: true, unique: true } },
  { timestamps: true }
);

const UserModel =
  mongoose.models.User ?? mongoose.model("User", UserSchema);
const TenantProfileModel =
  mongoose.models.TenantProfile ?? mongoose.model("TenantProfile", TenantProfileSchema);

async function cleanup() {
  await mongoose.connect(MONGO_URI as string, { dbName: "zudobot_saas" });
  console.log("Connected to MongoDB");

  // หา users ที่ยังไม่ complete onboarding และไม่ใช่ admin
  const staleUsers = (await UserModel.find({
    onboardingComplete: false,
    role: { $in: ["tenant", "partner_admin"] },
  }).lean()) as unknown as Array<{ _id: mongoose.Types.ObjectId; email: string; name?: string; tenantId?: string }>;

  if (staleUsers.length === 0) {
    console.log("ไม่พบ stale users — ฐานข้อมูลสะอาดอยู่แล้ว");
    await mongoose.disconnect();
    return;
  }

  console.log(`\nพบ stale users จำนวน ${staleUsers.length} รายการ:`);
  staleUsers.forEach((u, i) => {
    console.log(`  ${i + 1}. ${u.email} (id: ${u._id}, name: ${u.name ?? "-"})`);
  });

  const userIds     = staleUsers.map((u) => u._id);
  const tenantIds   = staleUsers.map((u) => u.tenantId ?? u._id.toString());

  // ลบ TenantProfiles ที่เกี่ยวข้อง
  const profileResult = await TenantProfileModel.deleteMany({
    tenantId: { $in: tenantIds },
  });
  console.log(`\nลบ TenantProfile: ${profileResult.deletedCount} รายการ`);

  // ลบ Users
  const userResult = await UserModel.deleteMany({ _id: { $in: userIds } });
  console.log(`ลบ Users: ${userResult.deletedCount} รายการ`);

  console.log("\nCleanup เสร็จสิ้น");
  await mongoose.disconnect();
}

cleanup().catch((err) => {
  console.error("Cleanup failed:", err);
  process.exit(1);
});
