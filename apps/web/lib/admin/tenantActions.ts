/**
 * Shared tenant mutation logic — used by both the legacy
 * app/api/admin/tenants/[id]/route.ts endpoint and the unified
 * app/api/admin/accounts/[email]/actions/route.ts endpoint, so the two
 * never drift out of sync.
 */
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
  const sub = await SubscriptionModel.findOne({
    tenantId,
    status: { $in: ["active", "trialing", "past_due"] },
  });
  if (!sub?.stripeSubId) return;
  try {
    const stripe = getStripe();
    await stripe.subscriptions.cancel(sub.stripeSubId);
  } catch (err) {
    console.error(`[tenantActions] Stripe cancel failed for ${tenantId}:`, err);
  }
}

export async function softDeleteTenant(tenantId: string): Promise<{ deletionDate: string }> {
  const deletionDate = new Date(Date.now() + NINETY_DAYS_MS);
  await UserModel.findByIdAndUpdate(tenantId, {
    pendingDeleteAt: deletionDate,
    deletedByAdmin:  true,
    botState:        "disabled",
  });
  return { deletionDate: deletionDate.toISOString() };
}

export async function hardDeleteTenant(tenantId: string): Promise<void> {
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

export async function restoreTenant(
  tenantId: string,
): Promise<{ ok: true; message: "already_active" } | { ok: true; restoredState: string } | { ok: false; error: "not_found" }> {
  const user = await UserModel.findById(tenantId);
  if (!user) return { ok: false, error: "not_found" };
  if (!user.pendingDeleteAt) return { ok: true, message: "already_active" };

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
  return { ok: true, restoredState };
}

/** Directly override botState (used by the unified accounts "set_bot_state" action). */
export async function setTenantBotState(tenantId: string, botState: string): Promise<void> {
  await UserModel.findByIdAndUpdate(tenantId, { botState });
}

/**
 * Generic reactivate (unified accounts "reactivate" action) — distinct from
 * restoreTenant(), which only acts when pendingDeleteAt is set. This recomputes
 * the appropriate active-ish state regardless of why the account was suspended.
 */
export async function reactivateTenant(tenantId: string): Promise<{ ok: true; restoredState: string } | { ok: false; error: "not_found" }> {
  const user = await UserModel.findById(tenantId);
  if (!user) return { ok: false, error: "not_found" };

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
  return { ok: true, restoredState };
}
