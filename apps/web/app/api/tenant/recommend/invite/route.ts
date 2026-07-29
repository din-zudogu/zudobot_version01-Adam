import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { connectDB } from "@/lib/db/connect";
import { UserModel } from "@/lib/db/models/User";
import { TenantProfileModel } from "@/lib/db/models/TenantProfile";
import { ensureReferralMasterData } from "@/lib/db/pg/ensureReferralMasterData";
import { createReferralInvite, findPendingInviteForReferrer } from "@/lib/db/referral";
import { generateSecretCode } from "@/lib/referral/pointsEngine";
import { sendReferralInviteEmail } from "@/lib/email/resend";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INVITE_VALID_DAYS = 90;

function signupUrlFor(secretCode: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://zudobot.zudogu.com";
  return `${base}/register?ref=${encodeURIComponent(secretCode)}`;
}

export async function POST(req: NextRequest) {
  const token = await getServerToken(req);
  if (!token?.sub || token.role !== "tenant") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { email?: string; shopNameHint?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }

  const tenantId = token.sub as string;

  try {
    await Promise.all([connectDB(), ensureReferralMasterData()]);

    const [referrerUser, referrerProfile] = await Promise.all([
      UserModel.findById(tenantId).select("email"),
      TenantProfileModel.findOne({ tenantId }).select("businessName"),
    ]);

    if (referrerUser?.email?.toLowerCase() === email) {
      return NextResponse.json({ error: "cannot_refer_self" }, { status: 400 });
    }

    const existing = await findPendingInviteForReferrer(tenantId, email);
    if (existing && existing.expiresAt > new Date()) {
      return NextResponse.json({ error: "already_invited" }, { status: 409 });
    }

    const secretCode = generateSecretCode();
    const expiresAt = new Date(Date.now() + INVITE_VALID_DAYS * 24 * 60 * 60 * 1000);
    const invite = await createReferralInvite({
      referrerTenantId: tenantId,
      inviteeEmail: email,
      secretCode,
      shopNameHint: body.shopNameHint?.trim() || undefined,
      expiresAt,
    });

    const referrerName = referrerProfile?.businessName || referrerUser?.email || "เพื่อนของคุณ";

    try {
      await sendReferralInviteEmail({
        to: email,
        referrerName,
        signupUrl: signupUrlFor(secretCode),
        secretCode,
        expiresAt,
      });
    } catch (err) {
      console.error("[recommend-invite] email send failed:", err);
    }

    return NextResponse.json({ invite: { id: invite.id, inviteeEmail: invite.inviteeEmail, status: invite.status, createdAt: invite.createdAt } });
  } catch (err) {
    console.error("[recommend-invite] failed:", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
