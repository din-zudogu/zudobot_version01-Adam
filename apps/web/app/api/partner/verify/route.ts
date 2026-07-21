import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { PartnerProfileModel } from "@/lib/db/models/PartnerProfile";
import { UserModel } from "@/lib/db/models/User";
import { getServerToken } from "@/lib/auth/getServerToken";
import { logSystemEvent } from "@/lib/logging/systemLogger";

/**
 * GET /api/partner/verify?token=xxx
 * Public — checks token status before auth. Returns companyName so the page
 * can show context without requiring a login first.
 */
export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get("token");
  if (!token) return NextResponse.json({ status: "not_found" });

  await connectDB();

  const partner = await PartnerProfileModel
    .findOne({ inviteToken: token, deletedAt: { $exists: false } })
    .select("companyName status inviteExpiresAt verifyLockedAt verifyAttempts")
    .lean() as {
      companyName: string;
      status: string;
      inviteExpiresAt?: Date;
      verifyLockedAt?: Date;
      verifyAttempts?: number;
    } | null;

  if (!partner) return NextResponse.json({ status: "not_found" });
  if (partner.verifyLockedAt) {
    return NextResponse.json({ status: "locked", companyName: partner.companyName });
  }
  if (partner.inviteExpiresAt && partner.inviteExpiresAt < new Date()) {
    return NextResponse.json({ status: "expired", companyName: partner.companyName });
  }
  if (partner.status === "active") {
    return NextResponse.json({ status: "already_joined", companyName: partner.companyName });
  }

  return NextResponse.json({ status: "valid", companyName: partner.companyName });
}

/**
 * POST /api/partner/verify
 * Validates the 6-digit code and activates the partner account.
 * Requires an active session — called from /partner/verify after Google SSO.
 * Body: { token: string, code: string }
 */
export async function POST(req: NextRequest) {
  const sessionToken = await getServerToken(req);
  if (!sessionToken?.sub) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  let body: { token?: string; code?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  const { token, code } = body;
  if (!token || !code) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  await connectDB();

  const partner = await PartnerProfileModel.findOne({
    inviteToken: token,
    deletedAt: { $exists: false },
  });

  if (!partner) return NextResponse.json({ error: "invalid_token" }, { status: 400 });
  if (partner.verifyLockedAt) return NextResponse.json({ error: "locked" }, { status: 403 });
  if (partner.inviteExpiresAt && partner.inviteExpiresAt < new Date()) {
    return NextResponse.json({ error: "expired" }, { status: 400 });
  }
  if (partner.status === "active" && partner.userId && !partner.userId.startsWith("pending_")) {
    return NextResponse.json({ error: "already_joined" }, { status: 409 });
  }

  // Email of the signed-in Google account must match the invited email
  const sessionEmail = (sessionToken.email as string | undefined)?.toLowerCase();
  if (!sessionEmail || sessionEmail !== partner.inviteEmail.toLowerCase()) {
    return NextResponse.json(
      { error: "email_mismatch", inviteEmail: partner.inviteEmail },
      { status: 403 }
    );
  }

  // Validate the 6-digit code
  if (partner.verifyCode !== code.trim()) {
    const newAttempts = (partner.verifyAttempts ?? 0) + 1;
    if (newAttempts >= 5) {
      await PartnerProfileModel.findByIdAndUpdate(partner._id, {
        $set:  { verifyAttempts: newAttempts, verifyLockedAt: new Date() },
      });
      return NextResponse.json({ error: "locked" }, { status: 403 });
    }
    await PartnerProfileModel.findByIdAndUpdate(partner._id, {
      $set: { verifyAttempts: newAttempts },
    });
    return NextResponse.json(
      { error: "invalid_code", attemptsLeft: 5 - newAttempts },
      { status: 400 }
    );
  }

  // Code is correct — activate partner account
  const isPending = !!(sessionToken as { pendingRegistration?: boolean }).pendingRegistration;
  const googleSub = ((sessionToken as { googleSub?: string }).googleSub ?? sessionToken.sub) as string;

  let user;

  if (isPending) {
    // C path: no MongoDB _id yet — identify by email from JWT
    user = await UserModel.findOne({ email: sessionEmail });

    if (!user) {
      // Truly new account — create directly as partner_admin
      const newUser = await UserModel.create({
        email:              sessionEmail,
        name:               (sessionToken.name as string | undefined) ?? sessionEmail,
        googleId:           googleSub,
        image:              (sessionToken.picture as string | undefined) ?? undefined,
        role:               "partner_admin",
        roles:              ["partner_admin"],
        onboardingComplete: true,
      });
      await UserModel.findByIdAndUpdate(newUser._id, { tenantId: newUser._id.toString() });
      await PartnerProfileModel.findByIdAndUpdate(partner._id, {
        $set:   { userId: newUser._id.toString(), email: sessionEmail, status: "active", verifyAttempts: 0 },
        $unset: { inviteToken: "", inviteExpiresAt: "", verifyCode: "", verifyCodeExpiresAt: "", verifyLockedAt: "" },
      });
      await logSystemEvent({
        category: "auth", action: "signup", email: sessionEmail,
        details: { role: "partner_admin" },
      });
      return NextResponse.json({ success: true });
    }
  } else {
    user = await UserModel.findById(sessionToken.sub);
    if (!user) return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }

  // Existing user — add partner_admin role
  const isExistingOnboardedTenant = user.onboardingComplete && user.role === "tenant";
  await UserModel.findByIdAndUpdate(user._id, {
    $addToSet: { roles: "partner_admin" },
    $set: {
      ...(!isExistingOnboardedTenant ? { role: "partner_admin" } : {}),
      onboardingComplete: true,
    },
  });

  await PartnerProfileModel.findByIdAndUpdate(partner._id, {
    $set:   { userId: user._id.toString(), email: sessionEmail, status: "active", verifyAttempts: 0 },
    $unset: { inviteToken: "", inviteExpiresAt: "", verifyCode: "", verifyCodeExpiresAt: "", verifyLockedAt: "" },
  });
  await logSystemEvent({
    category: "auth", action: "partner_role_added", email: sessionEmail,
  });

  return NextResponse.json({ success: true });
}
