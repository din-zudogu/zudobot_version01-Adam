/**
 * POST /api/admin/create-tenant
 * super_admin/admin creates a brand-new tenant account on behalf of a
 * customer, keyed to their Google Gmail. Replicates the minimum "shape"
 * apps/web/app/api/onboarding/complete/route.ts writes for a new tenant so
 * the customer lands directly in their dashboard on first Google sign-in —
 * no onboarding wizard, no password. googleId is intentionally left unset;
 * it self-backfills on first sign-in (matched by email) via the NextAuth
 * signIn callback in apps/web/lib/auth/config.ts.
 */
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getServerToken } from "@/lib/auth/getServerToken";
import { connectDB } from "@/lib/db/connect";
import { UserModel } from "@/lib/db/models/User";
import { TenantProfileModel } from "@/lib/db/models/TenantProfile";
import { AMPLIFY_CONFIG } from "@/lib/env/amplifyGuardrail";
import { sendAdminCreatedTenantWelcomeEmail } from "@/lib/email/resend";
import { logSystemEvent } from "@/lib/logging/systemLogger";

function requireAdmin(role?: string) {
  return role === "admin" || role === "super_admin";
}

interface Body {
  email:        string;
  businessName: string;
  businessType: string;
}

export async function POST(req: NextRequest) {
  const token = await getServerToken(req);
  if (!requireAdmin(token?.role as string)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const email        = String(body.email ?? "").trim().toLowerCase();
  const businessName = String(body.businessName ?? "").trim();
  const businessType = String(body.businessType ?? "").trim();

  if (!email.includes("@")) {
    return NextResponse.json({ error: "email_invalid" }, { status: 400 });
  }
  if (!businessName || !businessType) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  try {
    await connectDB();

    const existing = await UserModel.findOne({ email }).select("_id").lean();
    if (existing) {
      return NextResponse.json({ error: "email_already_exists" }, { status: 409 });
    }

    const user = await UserModel.create({
      email,
      name:               businessName,
      role:               "tenant",
      roles:              ["tenant"],
      botState:           "trial",
      trialEndsAt:        new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      onboardingComplete: true,
    });
    const tenantId = user._id.toString();
    await UserModel.findByIdAndUpdate(user._id, { tenantId });

    const embedKey = crypto.randomBytes(16).toString("hex");
    await TenantProfileModel.create({
      tenantId,
      businessName,
      businessType,
      embedKey,
      trialStartedAt: new Date(),
    });

    await logSystemEvent({
      category:   "admin_action",
      action:     "admin_create_tenant",
      email,
      actorEmail: token!.email?.toLowerCase(),
      details:    { tenantId, businessName, businessType },
    });

    try {
      await sendAdminCreatedTenantWelcomeEmail({
        to:   email,
        name: businessName,
        businessName,
        loginUrl: `${AMPLIFY_CONFIG.authUrl}/login`,
      });
    } catch (err) {
      console.error("[admin/create-tenant] welcome email failed:", err);
    }

    return NextResponse.json({ ok: true, tenantId, email, name: businessName });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "server_error";
    console.error("[admin/create-tenant]", msg);
    return NextResponse.json({ error: "server_error", detail: msg }, { status: 500 });
  }
}
