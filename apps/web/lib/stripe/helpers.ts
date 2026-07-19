/**
 * Stripe helpers — customer management, checkout sessions, portal links.
 *
 * Non-Enterprise: Stripe Subscription with PromptPay or card (monthly recurring).
 * Enterprise: Stripe Invoice with card only + recurring via cron.
 *
 * All prices are in THB (satang = THB × 100).
 */

import { getStripe } from "./client";
import type { PlanId, MemoryAddonId, RetentionAddonId } from "@/lib/payment/pmRules";
import {
  PLAN_CATALOG,
  MEMORY_ADDON_CATALOG,
  RETENTION_ADDON_CATALOG,
  calculatePrice,
  DEFAULT_PM_CONFIG,
} from "@/lib/payment/pmRules";
import { AMPLIFY_CONFIG } from "@/lib/env/amplifyGuardrail";

function getBaseUrl(): string {
  return AMPLIFY_CONFIG.authUrl;
}

// ── Stripe price IDs from env (pre-created in Stripe dashboard) ───
// Format: STRIPE_PRICE_<PLAN>_<MEMORY>_<RETENTION>
// For simplicity we create a single recurring price per (plan × memory × retention) combo.
// The helper below constructs/retrieves a price on-the-fly using Stripe Price API.

export async function getOrCreateStripePrice(
  planId: PlanId,
  memoryId: MemoryAddonId,
  retentionId: RetentionAddonId
): Promise<string> {
  const stripe = getStripe();
  const breakdown = calculatePrice(planId, memoryId, retentionId, DEFAULT_PM_CONFIG);
  const totalSatang = breakdown.total * 100; // THB → satang

  const nickname = `${planId}+${memoryId}+${retentionId}`;

  // Search for existing active price with this nickname
  const existing = await stripe.prices.list({
    active: true,
    currency: "thb",
    type: "recurring",
    limit: 100,
  });
  const found = existing.data.find((p) => p.nickname === nickname);
  if (found) return found.id;

  // Create product if needed
  const products = await stripe.products.list({ active: true, limit: 100 });
  let product = products.data.find((p) => p.name === "Zudobot Subscription");
  if (!product) {
    product = await stripe.products.create({ name: "Zudobot Subscription" });
  }

  // Create the price
  const price = await stripe.prices.create({
    product:    product.id,
    unit_amount: totalSatang,
    currency:   "thb",
    nickname,
    recurring:  { interval: "month" },
  });

  return price.id;
}

// ── Ensure Stripe customer exists for tenant ─────────────────────
export async function ensureStripeCustomer(
  tenantId: string,
  email: string,
  name: string,
  existingCustomerId?: string
): Promise<string> {
  const stripe = getStripe();

  if (existingCustomerId) {
    try {
      const cust = await stripe.customers.retrieve(existingCustomerId);
      if (!cust.deleted) return existingCustomerId;
    } catch { /* fall through to create */ }
  }

  const customer = await stripe.customers.create({
    email,
    name,
    metadata: { tenantId },
  });
  return customer.id;
}

// ── Create checkout session (Subscription — non-Enterprise) ───────
export interface CheckoutOptions {
  tenantId:       string;
  email:          string;
  name:           string;
  customerId?:    string;
  planId:         PlanId;
  memoryId:       MemoryAddonId;
  retentionId:    RetentionAddonId;
  paymentMethod:  "card" | "promptpay";
}

export async function createCheckoutSession(opts: CheckoutOptions): Promise<string> {
  const stripe = getStripe();

  const customerId = await ensureStripeCustomer(
    opts.tenantId, opts.email, opts.name, opts.customerId
  );

  const commonMeta = {
    tenantId:    opts.tenantId,
    planId:      opts.planId,
    memoryId:    opts.memoryId,
    retentionId: opts.retentionId,
  };

  // ── PromptPay: one-time payment (30-day manual renewal) ──────────
  // Stripe subscriptions do not support PromptPay; use mode:"payment" instead.
  // The webhook activates the subscription for 30 days on checkout.session.completed.
  if (opts.paymentMethod === "promptpay") {
    const breakdown = calculatePrice(opts.planId, opts.memoryId, opts.retentionId, DEFAULT_PM_CONFIG);
    const planLabel = `${PLAN_CATALOG[opts.planId].label} + ${MEMORY_ADDON_CATALOG[opts.memoryId].label} + ${RETENTION_ADDON_CATALOG[opts.retentionId].label}`;

    const session = await stripe.checkout.sessions.create({
      customer:             customerId,
      mode:                 "payment",
      payment_method_types: ["promptpay"],
      line_items: [{
        price_data: {
          currency:     "thb",
          unit_amount:  breakdown.total * 100,
          product_data: {
            name:        `Zudobot ${PLAN_CATALOG[opts.planId].label}`,
            description: `${planLabel} (1 เดือน)`,
          },
        },
        quantity: 1,
      }],
      success_url: `${getBaseUrl()}/dashboard/billing?success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${getBaseUrl()}/dashboard/billing?cancelled=1`,
      metadata: { ...commonMeta, isPromptPay: "true" },
      payment_intent_data: { metadata: { ...commonMeta, isPromptPay: "true" } },
    });

    return session.url!;
  }

  // ── Card: recurring Stripe Subscription ──────────────────────────
  const priceId = await getOrCreateStripePrice(opts.planId, opts.memoryId, opts.retentionId);

  const session = await stripe.checkout.sessions.create({
    customer:             customerId,
    mode:                 "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${getBaseUrl()}/dashboard/billing?success=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:  `${getBaseUrl()}/dashboard/billing?cancelled=1`,
    metadata:    commonMeta,
    subscription_data: { metadata: commonMeta },
  });

  return session.url!;
}

// ── Create checkout session (custom amount — ReadyPackage / CustomPackage) ──
export interface CustomAmountCheckoutOptions {
  tenantId:      string;
  email:         string;
  name:          string;
  customerId?:   string;
  amountThb:     number;        // Final retail price in THB (server-validated, never from client)
  productName:   string;        // e.g. "ZUDOBOT-PRO"
  description:   string;        // shown on Stripe hosted page
  nickname:      string;        // used as Stripe Price.nickname for dedup (card only)
  paymentMethod: "card" | "promptpay";
  metadata:      Record<string, string>;
}

export async function createCustomAmountCheckoutSession(
  opts: CustomAmountCheckoutOptions,
): Promise<string> {
  const stripe = getStripe();

  const customerId = await ensureStripeCustomer(
    opts.tenantId, opts.email, opts.name, opts.customerId,
  );

  const amountSatang = Math.round(opts.amountThb * 100);

  // ── PromptPay: one-time payment ──────────────────────────────────────────────
  if (opts.paymentMethod === "promptpay") {
    const session = await stripe.checkout.sessions.create({
      customer:             customerId,
      mode:                 "payment",
      payment_method_types: ["promptpay"],
      line_items: [{
        price_data: {
          currency:     "thb",
          unit_amount:  amountSatang,
          product_data: { name: opts.productName, description: opts.description },
        },
        quantity: 1,
      }],
      success_url: `${getBaseUrl()}/dashboard/billing?success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${getBaseUrl()}/checkout`,
      metadata:    { ...opts.metadata, isPromptPay: "true" },
      payment_intent_data: { metadata: { ...opts.metadata, isPromptPay: "true" } },
    });
    return session.url!;
  }

  // ── Card: recurring Stripe Subscription ──────────────────────────────────────
  // Deduplicate price by nickname so we reuse existing Stripe prices
  const existing = await stripe.prices.list({
    active: true, currency: "thb", type: "recurring", limit: 100,
  });
  let priceId = existing.data.find((p) => p.nickname === opts.nickname)?.id;

  if (!priceId) {
    const products = await stripe.products.list({ active: true, limit: 100 });
    let product = products.data.find((p) => p.name === opts.productName);
    if (!product) {
      product = await stripe.products.create({ name: opts.productName });
    }
    const price = await stripe.prices.create({
      product:    product.id,
      unit_amount: amountSatang,
      currency:   "thb",
      nickname:   opts.nickname,
      recurring:  { interval: "month" },
    });
    priceId = price.id;
  }

  const session = await stripe.checkout.sessions.create({
    customer:             customerId,
    mode:                 "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${getBaseUrl()}/dashboard/billing?success=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:  `${getBaseUrl()}/checkout`,
    metadata:    opts.metadata,
    subscription_data: { metadata: opts.metadata },
  });

  return session.url!;
}

// ── Create billing portal session ────────────────────────────────
export async function createPortalSession(customerId: string): Promise<string> {
  const stripe = getStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer:   customerId,
    return_url: `${getBaseUrl()}/dashboard/billing`,
  });
  return session.url;
}

// ── Create Enterprise invoice (card + recurring) ──────────────────
export interface EnterpriseInvoiceOptions {
  customerId:  string;
  tenantId:    string;
  planId:      PlanId;
  memoryId:    MemoryAddonId;
  retentionId: RetentionAddonId;
  daysUntilDue: number; // from Master Config Group C
}

export async function createEnterpriseInvoice(opts: EnterpriseInvoiceOptions): Promise<string> {
  const stripe = getStripe();
  const breakdown = calculatePrice(opts.planId, opts.memoryId, opts.retentionId, DEFAULT_PM_CONFIG);

  const planLabel =
    `${PLAN_CATALOG[opts.planId].label} + ${MEMORY_ADDON_CATALOG[opts.memoryId].label} + ` +
    RETENTION_ADDON_CATALOG[opts.retentionId].label;

  const invoiceItem = await stripe.invoiceItems.create({
    customer:    opts.customerId,
    amount:      breakdown.total * 100,
    currency:    "thb",
    description: `Zudobot ${planLabel} (รายเดือน)`,
  });

  const invoice = await stripe.invoices.create({
    customer:      opts.customerId,
    days_until_due: opts.daysUntilDue,
    collection_method: "send_invoice",
    metadata: {
      tenantId:    opts.tenantId,
      planId:      opts.planId,
      memoryId:    opts.memoryId,
      retentionId: opts.retentionId,
      invoiceItemId: invoiceItem.id,
    },
  });

  await stripe.invoices.finalizeInvoice(invoice.id);
  return invoice.id;
}
