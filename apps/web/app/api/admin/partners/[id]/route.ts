import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { connectDB } from "@/lib/db/connect";
import { PartnerProfileModel, generateInviteToken, generateVerifyCode, verifyUrl } from "@/lib/db/models/PartnerProfile";
import { SubscriptionModel } from "@/lib/db/models/Subscription";
import { UserModel } from "@/lib/db/models/User";
import { sendPartnerInviteEmail } from "@/lib/email/resend";

type Params = { params: Promise<{ id: string }> };

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

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

  // ── Delete / restore actions ─────────────────────────────────────────────
  if (body.action) {
    const partner = await PartnerProfileModel.findById(id);
    if (!partner) return NextResponse.json({ error: "not_found" }, { status: 404 });

    const hasRealUser = partner.userId && !partner.userId.startsWith("pending_");

    if (body.action === "soft_delete") {
      const deletionDate = new Date(Date.now() + NINETY_DAYS_MS);

      // Update PartnerProfile (for display in admin UI)
      await PartnerProfileModel.findByIdAndUpdate(id, {
        $set: { pendingDeleteAt: deletionDate, status: "suspended" },
      });

      // Block the partner's login if they have a real User record
      if (hasRealUser) {
        await UserModel.findByIdAndUpdate(partner.userId, {
          pendingDeleteAt: deletionDate,
          deletedByAdmin:  true,
        });
      }

      return NextResponse.json({ ok: true, deletionDate: deletionDate.toISOString() });
    }

    if (body.action === "hard_delete") {
      // Unlink all tenants referred by this partner
      await SubscriptionModel.updateMany(
        { referredByPartnerId: id },
        { $unset: { referredByPartnerId: 1, partnerStripeAccountId: 1 } }
      );

      // Delete PartnerProfile and User (if real)
      await Promise.all([
        PartnerProfileModel.deleteOne({ _id: id }),
        hasRealUser ? UserModel.deleteOne({ _id: partner.userId }) : Promise.resolve(),
      ]);

      return NextResponse.json({ ok: true });
    }

    if (body.action === "restore") {
      if (!partner.pendingDeleteAt) {
        return NextResponse.json({ ok: true, message: "already_active" });
      }

      await PartnerProfileModel.findByIdAndUpdate(id, {
        $unset: { pendingDeleteAt: 1 },
        $set:   { status: "active" },
      });

      if (hasRealUser) {
        await UserModel.findByIdAndUpdate(partner.userId, {
          $unset: { pendingDeleteAt: 1, deletedByAdmin: 1 },
        });
      }

      return NextResponse.json({ ok: true });
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
  return NextResponse.json({ success: true });
}
