import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { connectDB } from "@/lib/db/connect";
import { UserModel } from "@/lib/db/models/User";
import { TenantProfileModel } from "@/lib/db/models/TenantProfile";

/**
 * DELETE /api/user/self
 * Called when a user cancels an incomplete onboarding.
 * Deletes the User document and associated TenantProfile (B: clean slate).
 * Only allowed when onboardingComplete is false — safety guard prevents
 * accidental deletion of active accounts.
 */
export async function DELETE(req: NextRequest) {
  const token = await getServerToken(req);
  if (!token?.sub) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  // C path: User doc was never created — nothing to delete
  const isPending = !!(token as { pendingRegistration?: boolean }).pendingRegistration;
  if (isPending) {
    return NextResponse.json({ deleted: false, reason: "pending" });
  }

  await connectDB();

  const user = await UserModel.findById(token.sub);
  if (!user) {
    return NextResponse.json({ deleted: false, reason: "not_found" });
  }

  // Safety guard: never delete an account that has completed onboarding
  if (user.onboardingComplete) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  await UserModel.deleteOne({ _id: user._id });
  await TenantProfileModel.deleteOne({ tenantId: user._id.toString() });

  return NextResponse.json({ deleted: true });
}
