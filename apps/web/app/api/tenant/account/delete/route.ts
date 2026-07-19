/**
 * POST /api/tenant/account/delete
 *
 * Body: { type: "soft" | "hard" }
 *
 * soft — marks account pendingDeleteAt = now + 90 days, disables bot
 * hard — cancels Stripe subscription, cascade-deletes all tenant data, returns { ok: true }
 *        (client should call signOut after receiving ok)
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

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

async function cancelStripeSubscription(tenantId: string) {
  const sub = await SubscriptionModel.findOne({ tenantId, status: { $in: ["active", "trialing", "past_due"] } });
  if (!sub?.stripeSubId) return;
  try {
    const stripe = getStripe();
    await stripe.subscriptions.cancel(sub.stripeSubId);
  } catch (err) {
    console.error("[account/delete] Stripe cancel failed:", err);
    // non-fatal — proceed with DB deletion
  }
}

async function hardDeleteTenant(tenantId: string) {
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
}

export async function POST(req: NextRequest) {
  const token = await getServerToken(req);
  if (!token?.sub || token.role !== "tenant") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { type?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid_body" }, { status: 400 }); }

  if (body.type !== "soft" && body.type !== "hard") {
    return NextResponse.json({ error: "type must be 'soft' or 'hard'" }, { status: 400 });
  }

  const tenantId = token.sub;
  await connectDB();

  try {
    if (body.type === "soft") {
      const deletionDate = new Date(Date.now() + NINETY_DAYS_MS);
      await UserModel.findByIdAndUpdate(tenantId, {
        pendingDeleteAt: deletionDate,
        botState: "disabled",
      });
      return NextResponse.json({ ok: true, deletionDate: deletionDate.toISOString() });
    }

    // Hard delete
    await hardDeleteTenant(tenantId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[account/delete]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
