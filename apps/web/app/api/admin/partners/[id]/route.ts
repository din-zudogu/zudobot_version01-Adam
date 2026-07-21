import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { connectDB } from "@/lib/db/connect";
import { PartnerProfileModel, generateInviteToken, generateVerifyCode, verifyUrl } from "@/lib/db/models/PartnerProfile";
import { SubscriptionModel } from "@/lib/db/models/Subscription";
import { sendPartnerInviteEmail } from "@/lib/email/resend";
import { softDeletePartner, hardDeletePartner, restorePartner } from "@/lib/admin/partnerActions";
import { logSystemEvent } from "@/lib/logging/systemLogger";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const token = await getServerToken(_req);
  if (token?.role !== "super_admin" && token?.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;
  await connectDB();

  const [partner, totalClients] = await Promise.all([
    PartnerProfileModel.findById(id).select("-inviteToken").lean(),
    SubscriptionModel.countDocuments({ referredByPartnerId: id }),
  ]);

  if (!partner) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ partner: { ...partner, totalClients } });
}

/**
 * PATCH /api/admin/partners/[id]
 *
 * Existing actions: { status, resendInvite }
 * New delete/restore actions: { action: "soft_delete" | "hard_delete" | "restore" }
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const token = await getServerToken(req);
  if (token?.role !== "super_admin" && token?.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;
  let body: {
    status?:       "active" | "suspended";
    resendInvite?: boolean;
    action?:       "soft_delete" | "hard_delete" | "restore";
  };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  await connectDB();

  const actorEmail = (token.email as string | undefined)?.toLowerCase();

  // ── Delete / restore actions ─────────────────────────────────────────────
  if (body.action) {
    const partnerForLog = await PartnerProfileModel.findById(id).select("email").lean() as { email?: string } | null;
    if (!partnerForLog) return NextResponse.json({ error: "not_found" }, { status: 404 });

    if (body.action === "soft_delete") {
      const result = await softDeletePartner(id);
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: 404 });
      await logSystemEvent({
        category: "admin_action", action: "soft_delete", email: partnerForLog.email, actorEmail,
        details: { targetType: "partner", deletionDate: result.deletionDate },
      });
      return NextResponse.json({ ok: true, deletionDate: result.deletionDate });
    }

    if (body.action === "hard_delete") {
      const result = await hardDeletePartner(id);
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: 404 });
      await logSystemEvent({
        category: "admin_action", action: "hard_delete", email: partnerForLog.email, actorEmail,
        details: { targetType: "partner" },
      });
      return NextResponse.json({ ok: true });
    }

    if (body.action === "restore") {
      const result = await restorePartner(id);
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: 404 });
      await logSystemEvent({
        category: "admin_action", action: "restore", email: partnerForLog.email, actorEmail,
        details: { targetType: "partner" },
      });
      return NextResponse.json(result);
    }
  }

  // ── Existing: status update / resend invite ──────────────────────────────
  const partner = await PartnerProfileModel.findById(id);
  if (!partner) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const updates: Record<string, unknown> = {};
  if (body.status) updates.status = body.status;

  let newVerifyCode: string | undefined;
  if (body.resendInvite) {
    const inviteToken         = generateInviteToken();
    newVerifyCode             = generateVerifyCode();
    const inviteExpiresAt     = new Date(Date.now() + 24 * 60 * 60 * 1000);
    updates.inviteToken          = inviteToken;
    updates.inviteExpiresAt      = inviteExpiresAt;
    updates.verifyCode           = newVerifyCode;
    updates.verifyCodeExpiresAt  = inviteExpiresAt;
    updates.verifyAttempts       = 0;
    updates.verifyLockedAt       = undefined;
  }

  const updated = await PartnerProfileModel.findByIdAndUpdate(
    id,
    body.resendInvite
      ? { $set: updates, $unset: { verifyLockedAt: "" } }
      : { $set: updates },
    { new: true }
  ).lean();

  if (!updated) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const result: Record<string, unknown> = { ...updated, inviteToken: undefined, verifyCode: undefined };
  if (body.resendInvite && updated.inviteToken) {
    const partnerVerifyUrl = verifyUrl(updated.inviteToken);
    result.verifyUrl   = partnerVerifyUrl;
    result.verifyCode  = newVerifyCode;
    let emailSent = false;
    try {
      await sendPartnerInviteEmail({
        to:          updated.email,
        companyName: updated.companyName,
        joinUrl:     partnerVerifyUrl,
        expiresAt:   updated.inviteExpiresAt ?? new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
      emailSent = true;
    } catch (err) {
      console.error("[partner-resend] email send failed:", err);
    }
    result.emailSent = emailSent;
  }

  if (body.status) {
    await logSystemEvent({
      category: "admin_action", action: "set_status", email: partner.email, actorEmail,
      details: { targetType: "partner", status: body.status },
    });
  }
  if (body.resendInvite) {
    await logSystemEvent({
      category: "admin_action", action: "resend_invite", email: partner.email, actorEmail,
    });
  }

  return NextResponse.json({ partner: result });
}

/** DELETE — legacy soft-delete (sets deletedAt immediately, no 90-day pending window). */
export async function DELETE(req: NextRequest, { params }: Params) {
  const token = await getServerToken(req);
  if (token?.role !== "super_admin" && token?.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;
  await connectDB();

  const partner = await PartnerProfileModel.findByIdAndUpdate(
    id,
    { $set: { deletedAt: new Date() } },
    { new: true }
  ).lean();

  if (!partner) return NextResponse.json({ error: "not_found" }, { status: 404 });
  await logSystemEvent({
    category: "admin_action", action: "legacy_soft_delete", email: partner.email,
    actorEmail: (token.email as string | undefined)?.toLowerCase(),
    details: { targetType: "partner" },
  });
  return NextResponse.json({ success: true });
}
