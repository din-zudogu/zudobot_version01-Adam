/**
 * PATCH /api/admin/tenants/[id]
 * Body: { action: "soft_delete" | "hard_delete" | "restore" }
 *
 * soft_delete — sets pendingDeleteAt +90 days, deletedByAdmin=true, botState="disabled"
 * hard_delete — cancels Stripe subscription + cascade-deletes all tenant data
 * restore     — clears pendingDeleteAt + deletedByAdmin, restores appropriate botState
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { connectDB } from "@/lib/db/connect";
import { UserModel } from "@/lib/db/models/User";
import { TenantProfileModel } from "@/lib/db/models/TenantProfile";
import { SubscriptionModel } from "@/lib/db/models/Subscription";
import { ConversationSessionModel } from "@/lib/db/models/ConversationSession";
import { KnowledgeChunkModel } from "@/lib/db/models/KnowledgeChunk";
import { KnowledgeJobModel } from "@/lib/db/models/KnowledgeJob";
import { ProductModel } from "@/lib/db/models/Product";
import { NotificationModel } from "@/lib/db/models/Notification";
import { InvoiceModel } from "@/lib/db/models/Invoice";
import { getStripe } from "@/lib/stripe/client";

type Params = { params: Promise<{ id: string }> };

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

async function cancelStripeSubscription(tenantId: string) {
  const sub = await SubscriptionModel.findOne({
    tenantId,
    status: { $in: ["active", "trialing", "past_due"] },
  });
  if (!sub?.stripeSubId) return;
  try {
    const stripe = getStripe();
    await stripe.subscriptions.cancel(sub.stripeSubId);
  } catch (err) {
    console.error(`[admin/tenant-delete] Stripe cancel failed for ${tenantId}:`, err);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const token = await getServerToken(req);
  if (token?.role !== "super_admin" && token?.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id: tenantId } = await params;

  let body: { action?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  const { action } = body;
  if (!["soft_delete", "hard_delete", "restore"].includes(action ?? "")) {
    return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  }

  await connectDB();

  const user = await UserModel.findById(tenantId);
  if (!user) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (user.role !== "tenant") {
    return NextResponse.json({ error: "not_a_tenant" }, { status: 400 });
  }

  if (action === "soft_delete") {
    const deletionDate = new Date(Date.now() + NINETY_DAYS_MS);
    await UserModel.findByIdAndUpdate(tenantId, {
      pendingDeleteAt: deletionDate,
      deletedByAdmin:  true,
      botState:        "disabled",
    });
    return NextResponse.json({ ok: true, deletionDate: deletionDate.toISOString() });
  }

  if (action === "hard_delete") {
    await cancelStripeSubscription(tenantId);
    await Promise.all([
      UserModel.deleteOne({ _id: tenantId }),
      TenantProfileModel.deleteOne({ tenantId }),
      SubscriptionModel.deleteMany({ tenantId }),
      ConversationSessionModel.deleteMany({ tenantId }),
      KnowledgeChunkModel.deleteMany({ tenantId }),
      KnowledgeJobModel.deleteMany({ tenantId }),
      ProductModel.deleteMany({ tenantId }),
      NotificationModel.deleteMany({ tenantId }),
      InvoiceModel.deleteMany({ tenantId }),
    ]);
    return NextResponse.json({ ok: true });
  }

  // restore
  if (!user.pendingDeleteAt) {
    return NextResponse.json({ ok: true, message: "already_active" });
  }
  const sub = await SubscriptionModel.findOne({ tenantId, status: "active" });
  let restoredState: string;
  if (sub) {
    restoredState = "active";
  } else if (user.trialEndsAt && user.trialEndsAt > new Date()) {
    restoredState = "trial";
  } else {
    restoredState = "suspended_payment";
  }
  await UserModel.findByIdAndUpdate(tenantId, {
    $unset: { pendingDeleteAt: 1, deletedByAdmin: 1 },
    botState: restoredState,
  });
  return NextResponse.json({ ok: true, restoredState });
}
