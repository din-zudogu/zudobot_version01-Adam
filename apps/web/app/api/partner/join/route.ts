import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { PartnerProfileModel } from "@/lib/db/models/PartnerProfile";
import { UserModel } from "@/lib/db/models/User";
import { getServerToken } from "@/lib/auth/getServerToken";

/**
 * POST /api/partner/join
 * Completes partner onboarding after Google OAuth.
 * Requires an active session — called from /partner/join/callback.
 * Body: { token: string }
 */
export async function POST(req: NextRequest) {
  const sessionToken = await getServerToken(req);
  if (!sessionToken?.sub) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  let body: { token?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  const { token } = body;
  if (!token) {
    return NextResponse.json({ error: "missing_token" }, { status: 400 });
  }

  await connectDB();

  const partner = await PartnerProfileModel.findOne({ inviteToken: token });
  if (!partner) {
    return NextResponse.json({ error: "invalid_token" }, { status: 400 });
  }
  if (partner.inviteExpiresAt && partner.inviteExpiresAt < new Date()) {
    return NextResponse.json({ error: "token_expired" }, { status: 400 });
  }
  if (partner.status === "active" && partner.userId) {
    return NextResponse.json({ error: "already_joined" }, { status: 409 });
  }

  const isPending  = !!(sessionToken as { pendingRegistration?: boolean }).pendingRegistration;
  const googleSub  = ((sessionToken as { googleSub?: string }).googleSub ?? sessionToken.sub) as string;

  let user;

  if (isPending) {
    // C path: pending user — no MongoDB _id yet, identify by email from JWT
    const sessionEmail = (sessionToken.email as string | undefined)?.toLowerCase();
    if (!sessionEmail) {
      return NextResponse.json({ error: "missing_email" }, { status: 400 });
    }

    user = await UserModel.findOne({ email: sessionEmail });

    if (!user) {
      // Truly new account — validate email then create directly as partner_admin
      if (sessionEmail !== partner.inviteEmail.toLowerCase()) {
        return NextResponse.json(
          { error: "email_mismatch", inviteEmail: partner.inviteEmail },
          { status: 403 }
        );
      }
      const newUser = await UserModel.create({
        email:     sessionEmail,
        name:      (sessionToken.name as string | undefined) ?? sessionEmail,
        googleId:  googleSub,
        image:     (sessionToken.picture as string | undefined) ?? undefined,
        role:      "partner_admin",
        roles:     ["partner_admin"],
        onboardingComplete: true,
      });
      await UserModel.findByIdAndUpdate(newUser._id, { tenantId: newUser._id.toString() });
      await PartnerProfileModel.findByIdAndUpdate(partner._id, {
        $set:   { userId: newUser._id.toString(), email: partner.inviteEmail, status: "active" },
        $unset: { inviteToken: "", inviteExpiresAt: "" },
      });
      return NextResponse.json({ success: true });
    }
    // User found by email (registered before C was deployed) — fall through to existing-user logic
  } else {
    user = await UserModel.findById(sessionToken.sub);
    if (!user) {
      return NextResponse.json({ error: "user_not_found" }, { status: 404 });
    }
  }

  // Ensure the signed-in Google account matches the invited email
  if (user.email.toLowerCase() !== partner.inviteEmail.toLowerCase()) {
    return NextResponse.json(
      { error: "email_mismatch", inviteEmail: partner.inviteEmail },
      { status: 403 }
    );
  }

  // New users (never onboarded as tenant) → primary role becomes partner_admin.
  // Existing onboarded tenants → keep tenant as primary, add partner_admin to roles array.
  const isExistingOnboardedTenant = user.onboardingComplete && user.role === "tenant";
  await UserModel.findByIdAndUpdate(user._id, {
    $addToSet: { roles: "partner_admin" },
    $set: {
      ...(!isExistingOnboardedTenant ? { role: "partner_admin" } : {}),
      onboardingComplete: true,
    },
  });

  await PartnerProfileModel.findByIdAndUpdate(partner._id, {
    $set:   { userId: user._id.toString(), email: partner.inviteEmail, status: "active" },
    $unset: { inviteToken: "", inviteExpiresAt: "" },
  });

  return NextResponse.json({ success: true });
}
