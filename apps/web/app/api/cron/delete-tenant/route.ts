/**
 * POST /api/cron/delete-tenant
 *
 * Daily cron — hard-deletes all accounts whose pendingDeleteAt has passed.
 *   - tenant       → cancel Stripe sub + cascade-delete 9 collections
 *   - partner_admin → unlink Subscriptions referredByPartnerId + delete PartnerProfile + User
 *
 * Protected by INTERNAL_CRON_SECRET header (set in Vercel env vars).
 * Vercel cron schedule (vercel.json): "0 0 * * *"  →  00:00 UTC daily
 */
import { NextRequest, NextResponse } from "next/server";
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
import { PartnerProfileModel } from "@/lib/db/models/PartnerProfile";
import { getStripe } from "@/lib/stripe/client";

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
    console.error(`[cron/delete-tenant] Stripe cancel failed for ${tenantId}:`, err);
  }
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.INTERNAL_CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  await connectDB();

  const due = await UserModel.find({
    pendingDeleteAt: { $lte: new Date() },
    role: { $in: ["tenant", "partner_admin"] },
  }).select("_id role tenantId").lean() as Array<{ _id: { toString(): string }; role: string; tenantId?: string }>;

  if (due.length === 0) {
    return NextResponse.json({ ok: true, purged: 0 });
  }

  let purged = 0;
  const errors: string[] = [];

  for (const u of due) {
    const userId = u._id.toString();
    try {
      if (u.role === "partner_admin") {
        const partner = await PartnerProfileModel.findOne({ userId }).select("_id").lean();
        if (partner) {
          await SubscriptionModel.updateMany(
            { referredByPartnerId: partner._id.toString() },
            { $unset: { referredByPartnerId: 1, partnerStripeAccountId: 1 } }
          );
          await PartnerProfileModel.deleteOne({ _id: partner._id });
        }
        await UserModel.deleteOne({ _id: u._id });
      } else {
        const tenantId = u.tenantId ?? userId;
        await cancelStripeSubscription(tenantId);
        await Promise.all([
          UserModel.deleteOne({ _id: u._id }),
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
      purged++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${userId}: ${msg}`);
      console.error(`[cron/delete-tenant] Failed to delete ${u.role} ${userId}:`, err);
    }
  }

  console.log(`[cron/delete-tenant] Purged ${purged}/${due.length} accounts. Errors: ${errors.length}`);
  return NextResponse.json({ ok: true, purged, errors });
}
