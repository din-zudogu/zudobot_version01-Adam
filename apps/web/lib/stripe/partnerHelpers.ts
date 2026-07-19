/**
 * Stripe Connect helpers for the Partner (reseller) system.
 *
 * Financial flow:
 *   End-user pays endUserPrice → Partner's Stripe connected account
 *   Zudobot deducts partnerCost (application_fee_amount) → Zudobot platform account
 *   Partner keeps: endUserPrice - partnerCost - Stripe fees
 */

import { getStripe } from "./client";
import { getOrCreateStripePrice } from "./helpers";
import type { PlanId, MemoryAddonId, RetentionAddonId } from "@/lib/payment/pmRules";
import { AMPLIFY_CONFIG } from "@/lib/env/amplifyGuardrail";

function getBaseUrl(): string {
  return AMPLIFY_CONFIG.authUrl;
}

// ── Stripe Connect OAuth ──────────────────────────────────────────

/** Builds the Stripe Connect OAuth URL for a partner to connect their account. */
export function buildStripeConnectUrl(partnerId: string): string {
  const clientId = process.env.STRIPE_CONNECT_CLIENT_ID!;
  const state    = Buffer.from(partnerId).toString("base64url");
  const redirect = `${getBaseUrl()}/api/stripe/connect/callback`;

  const params = new URLSearchParams({
    response_type:    "code",
    client_id:        clientId,
    scope:            "read_write",
    redirect_uri:     redirect,
    state,
    "stripe_user[business_type]": "company",
    "stripe_user[url]":           getBaseUrl(),
  });

  return `https://connect.stripe.com/oauth/authorize?${params.toString()}`;
}

/** Exchange OAuth code for a connected account ID and store it on PartnerProfile. */
export async function exchangeStripeOAuthCode(code: string): Promise<{
  stripeConnectAccountId: string;
  partnerId: string;
}> {
  const stripe = getStripe();
  const response = await stripe.oauth.token({ grant_type: "authorization_code", code });
  const stripeConnectAccountId = response.stripe_user_id!;

  // state was set to base64url(partnerId) during authorize
  return { stripeConnectAccountId, partnerId: "" }; // caller resolves partnerId from state param
}

// ── Partner Checkout Session ──────────────────────────────────────

export interface PartnerCheckoutOptions {
  tenantId:               string;
  email:                  string;
  name:                   string;
  customerId?:            string;
  planId:                 PlanId;
  memoryId:               MemoryAddonId;
  retentionId:            RetentionAddonId;
  partnerStripeAccountId: string;   // acct_xxx — the connected account
  partnerCostThb:         number;   // fee Zudobot takes (from PackageConfig.partnerCost)
  endUserPriceThb:        number;   // price customer pays (from PackageConfig.priceThb sum)
  partnerId:              string;   // PartnerProfile._id (stored in Subscription)
  successPath?:           string;   // default: /dashboard/billing
  cancelPath?:            string;
}

/**
 * Creates a Stripe Checkout Session on the Partner's connected account
 * with an application_fee so Zudobot collects partnerCostThb automatically.
 */
export async function createPartnerCheckoutSession(opts: PartnerCheckoutOptions): Promise<string> {
  const stripe = getStripe();

  // Ensure a Stripe customer exists on the *connected account* for this tenant.
  // We create a customer directly on the connected account using the `stripeAccount` header.
  const connectedStripe = getStripe(); // same SDK — we pass stripeAccount per-call

  let customerId = opts.customerId;
  if (!customerId) {
    const cust = await connectedStripe.customers.create(
      { email: opts.email, name: opts.name, metadata: { tenantId: opts.tenantId } },
      { stripeAccount: opts.partnerStripeAccountId }
    );
    customerId = cust.id;
  }

  const priceId = await getOrCreateStripePrice(opts.planId, opts.memoryId, opts.retentionId);

  // application_fee_percent = partnerCost / endUserPrice * 100
  // Stripe rounds to 2 decimal places.
  const applicationFeePercent =
    opts.endUserPriceThb > 0
      ? parseFloat(((opts.partnerCostThb / opts.endUserPriceThb) * 100).toFixed(2))
      : 0;

  const commonMeta = {
    tenantId:    opts.tenantId,
    planId:      opts.planId,
    memoryId:    opts.memoryId,
    retentionId: opts.retentionId,
    partnerId:   opts.partnerId,
  };

  const successUrl = `${getBaseUrl()}${opts.successPath ?? "/dashboard/billing"}?success=1&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl  = `${getBaseUrl()}${opts.cancelPath  ?? "/dashboard/billing"}?cancelled=1`;

  const session = await stripe.checkout.sessions.create(
    {
      customer:             customerId,
      mode:                 "subscription",
      payment_method_types: ["card"],
      line_items:           [{ price: priceId, quantity: 1 }],
      success_url:          successUrl,
      cancel_url:           cancelUrl,
      metadata:             commonMeta,
      subscription_data: {
        metadata:               commonMeta,
        application_fee_percent: applicationFeePercent,
      },
    },
    { stripeAccount: opts.partnerStripeAccountId }
  );

  return session.url!;
}
