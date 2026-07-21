import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe/client";
import { connectDB } from "@/lib/db/connect";
import { UserModel } from "@/lib/db/models/User";
import { SubscriptionModel } from "@/lib/db/models/Subscription";
import { InvoiceModel, nextInvoiceNumber } from "@/lib/db/models/Invoice";
import {
  evaluateBotState,
  type BotStateContext,
} from "@/lib/payment/botStateMachine";
import {
  dailyCapForPlan,
  DEFAULT_PM_CONFIG,
  type PlanId,
  type MemoryAddonId,
  type RetentionAddonId,
  calculatePrice,
} from "@/lib/payment/pmRules";
import type { BotState } from "@/types";
import { logSystemEvent } from "@/lib/logging/systemLogger";

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig  = req.headers.get("stripe-signature") ?? "";

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, WEBHOOK_SECRET);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "invalid_signature";
    console.error("[webhook] signature verification failed:", msg);
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  try {
    await connectDB();
    await handleEvent(event);
    return NextResponse.json({ received: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "handler_error";
    console.error(`[webhook] handler error for ${event.type}:`, msg);
    return NextResponse.json({ error: "handler_error" }, { status: 500 });
  }
}

async function handleEvent(event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed":
      await onCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
      break;
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await onSubscriptionChanged(event.data.object as Stripe.Subscription);
      break;
    case "customer.subscription.deleted":
      await onSubscriptionDeleted(event.data.object as Stripe.Subscription);
      break;
    case "invoice.payment_succeeded":
      await onInvoicePaid(event.data.object as Stripe.Invoice);
      break;
    case "invoice.payment_failed":
      await onInvoiceFailed(event.data.object as Stripe.Invoice);
      break;
    default:
      break;
  }
}

// ── Handlers ──────────────────────────────────────────────────────

async function onCheckoutCompleted(session: Stripe.Checkout.Session) {
  const tenantId   = session.metadata?.tenantId;
  const customerId = session.customer as string;
  if (!tenantId) return;

  // Always persist the Stripe customer ID + ReadyPackage link (ถ้ามี) เพื่อให้นับโควต้าร้านค้าได้
  const readyPackageId   = session.metadata?.readyPackageId;
  const readyPackageName = session.metadata?.packageName;
  await SubscriptionModel.findOneAndUpdate(
    { tenantId },
    {
      stripeCustomerId: customerId,
      ...(readyPackageId   ? { readyPackageId }   : {}),
      ...(readyPackageName ? { readyPackageName } : {}),
    },
    { upsert: true }
  );

  // PromptPay one-time payment → manually activate for 30 days
  if (session.metadata?.isPromptPay === "true" && session.payment_status === "paid") {
    const planId      = (session.metadata.planId      as PlanId)          || "starter";
    const memoryId    = (session.metadata.memoryId    as MemoryAddonId)   || "free";
    const retentionId = (session.metadata.retentionId as RetentionAddonId) || "standard";

    const now       = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const breakdown = calculatePrice(planId, memoryId, retentionId, DEFAULT_PM_CONFIG);

    await SubscriptionModel.findOneAndUpdate(
      { tenantId },
      {
        stripeCustomerId:  customerId,
        planId,
        memoryAddonId:     memoryId,
        retentionAddonId:  retentionId,
        status:            "active",
        currentPeriodStart: now,
        currentPeriodEnd:   periodEnd,
        cancelAtPeriodEnd:  false,
        paymentMethod:     "promptpay",
        basePriceThb:      breakdown.base,
        memoryPriceThb:    breakdown.quota,
        retentionPriceThb: breakdown.retention,
        totalThb:          breakdown.total,
      },
      { upsert: true, new: true }
    );

    await syncBotState(tenantId, "active", planId);
    await logPaymentEvent(tenantId, "checkout.session.completed", { planId, isPromptPay: true });
  }
}

// ── Payment log helper ────────────────────────────────────────────
async function logPaymentEvent(tenantId: string, action: string, details?: Record<string, unknown>) {
  const user = await UserModel.findById(tenantId).select("email").lean() as { email?: string } | null;
  await logSystemEvent({ category: "payment", action, email: user?.email, details: { tenantId, ...details } });
}

async function onSubscriptionChanged(sub: Stripe.Subscription) {
  const tenantId    = sub.metadata?.tenantId;
  const planId      = (sub.metadata?.planId   as PlanId)          || "starter";
  const memoryId    = (sub.metadata?.memoryId as MemoryAddonId)   || "free";
  const retentionId = (sub.metadata?.retentionId as RetentionAddonId) || "standard";

  if (!tenantId) return;

  const status = sub.status as "active" | "past_due" | "canceled" | "unpaid" | "trialing" | "paused";
  // current_period_start/end moved to subscription item in Stripe API 2025+
  const item        = sub.items?.data?.[0];
  const subAny      = sub as unknown as Record<string, number>;
  const periodStart = item
    ? new Date((item as unknown as Record<string, number>).current_period_start * 1000)
    : subAny.current_period_start ? new Date(subAny.current_period_start * 1000) : new Date();
  const periodEnd   = item
    ? new Date((item as unknown as Record<string, number>).current_period_end * 1000)
    : subAny.current_period_end ? new Date(subAny.current_period_end * 1000) : new Date();

  const breakdown = calculatePrice(planId, memoryId, retentionId, DEFAULT_PM_CONFIG);

  await SubscriptionModel.findOneAndUpdate(
    { tenantId },
    {
      stripeSubId:         sub.id,
      stripeCustomerId:    sub.customer as string,
      planId,
      memoryAddonId:       memoryId,
      retentionAddonId:    retentionId,
      status,
      currentPeriodStart:  periodStart,
      currentPeriodEnd:    periodEnd,
      cancelAtPeriodEnd:   sub.cancel_at_period_end,
      basePriceThb:        breakdown.base,
      memoryPriceThb:      breakdown.quota,
      retentionPriceThb:   breakdown.retention,
      totalThb:            breakdown.total,
    },
    { upsert: true, new: true }
  );

  // Re-evaluate bot state
  await syncBotState(tenantId, status, planId);
  await logPaymentEvent(tenantId, "customer.subscription.changed", { planId, status });
}

async function onSubscriptionDeleted(sub: Stripe.Subscription) {
  const tenantId = sub.metadata?.tenantId;
  if (!tenantId) return;

  await SubscriptionModel.findOneAndUpdate(
    { tenantId },
    { status: "canceled", cancelledAt: new Date() }
  );
  await syncBotState(tenantId, "canceled", "starter");
  await logPaymentEvent(tenantId, "customer.subscription.deleted");
}

async function onInvoicePaid(invoice: Stripe.Invoice) {
  const tenantId = invoice.metadata?.tenantId ?? (invoice as unknown as { subscription_details?: { metadata?: { tenantId?: string } } }).subscription_details?.metadata?.tenantId;
  if (!tenantId) return;

  const sub = await SubscriptionModel.findOne({ tenantId });
  if (!sub) return;

  const invoiceNumber = await nextInvoiceNumber();
  const amountPaid    = (invoice.amount_paid ?? 0) / 100;

  await InvoiceModel.findOneAndUpdate(
    { stripeInvoiceId: invoice.id },
    {
      tenantId,
      subscriptionId: sub._id.toString(),
      stripeInvoiceId: invoice.id,
      invoiceNumber,
      status:       "paid",
      amountDueThb: (invoice.amount_due ?? 0) / 100,
      amountPaidThb: amountPaid,
      totalThb:     amountPaid,
      issuedAt:     new Date((invoice.created ?? 0) * 1000),
      dueDate:      invoice.due_date ? new Date(invoice.due_date * 1000) : new Date(),
      paidAt:       new Date(),
    },
    { upsert: true }
  );
  await logPaymentEvent(tenantId, "invoice.payment_succeeded", { amountPaidThb: amountPaid });
}

async function onInvoiceFailed(invoice: Stripe.Invoice) {
  const tenantId = invoice.metadata?.tenantId ?? (invoice as unknown as { subscription_details?: { metadata?: { tenantId?: string } } }).subscription_details?.metadata?.tenantId;
  if (!tenantId) return;

  await SubscriptionModel.findOneAndUpdate(
    { tenantId },
    {
      status:         "past_due",
      graceStartedAt: new Date(),
      graceDueDate:   graceDueDateFromConfig(),
    }
  );
  await syncBotState(tenantId, "past_due", "starter");
  await logPaymentEvent(tenantId, "invoice.payment_failed");
}

function graceDueDateFromConfig(): Date {
  const d = new Date();
  d.setDate(d.getDate() + DEFAULT_PM_CONFIG.nonEnterpriseGraceDays);
  return d;
}

// ── Bot state sync helper ─────────────────────────────────────────
async function syncBotState(
  tenantId: string,
  subStatus: string,
  planId: PlanId
) {
  const user = await UserModel.findById(tenantId);
  if (!user) return;

  const dailyCap = dailyCapForPlan(planId);

  const ctx: BotStateContext = {
    current:            user.botState as BotState ?? "trial",
    trialEndsAt:        user.trialEndsAt,
    dailyMsgCount:      0,  // webhook sync — quota checked separately
    dailyQuotaCap:      dailyCap,
    quotaGraceBuffer:   DEFAULT_PM_CONFIG.quotaGraceBufferPercent / 100,
    subscriptionStatus: subStatus as BotStateContext["subscriptionStatus"],
  };

  const { nextState } = evaluateBotState(ctx);
  if (nextState !== user.botState) {
    await UserModel.findByIdAndUpdate(tenantId, { botState: nextState });
    await logSystemEvent({
      category: "bot_state", action: "bot_state_change", email: user.email,
      details: { previousState: user.botState, nextState, reason: "stripe_webhook", subStatus },
    });
  }
}
