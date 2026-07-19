import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { connectDB } from "@/lib/db/connect";
import { UserModel } from "@/lib/db/models/User";
import { PartnerProfileModel } from "@/lib/db/models/PartnerProfile";

/** GET /api/admin/debug-user?email=xxx  — super_admin only, temporary diagnostic */
export async function GET(req: NextRequest) {
  const token = await getServerToken(req);
  if (token?.role !== "super_admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const email = new URL(req.url).searchParams.get("email")?.toLowerCase();
  if (!email) return NextResponse.json({ error: "missing email" }, { status: 400 });

  await connectDB();

  const user = await UserModel.findOne({ email }).select(
    "email role roles onboardingComplete botState googleId createdAt"
  ).lean();

  const partner = await PartnerProfileModel.findOne({ inviteEmail: email }).select(
    "companyName status userId inviteToken inviteExpiresAt deletedAt"
  ).lean();

  return NextResponse.json({ user, partner });
}
