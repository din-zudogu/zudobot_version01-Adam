import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { PartnerProfileModel } from "@/lib/db/models/PartnerProfile";
import { getStripe } from "@/lib/stripe/client";
import { AMPLIFY_CONFIG } from "@/lib/env/amplifyGuardrail";

function getBaseUrl(): string {
  return AMPLIFY_CONFIG.authUrl;
}

/**
 * Stripe Connect OAuth callback.
 * Public — Stripe redirects here with ?code= and ?state= (no auth cookie).
 * state was base64url(partnerId) set in buildStripeConnectUrl.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code  = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(`${getBaseUrl()}/partner/stripe-connect?error=${encodeURIComponent(error)}`);
  }
  if (!code || !state) {
    return NextResponse.redirect(`${getBaseUrl()}/partner/stripe-connect?error=missing_params`);
  }

  let partnerId: string;
  try {
    partnerId = Buffer.from(state, "base64url").toString("utf8");
  } catch {
    return NextResponse.redirect(`${getBaseUrl()}/partner/stripe-connect?error=invalid_state`);
  }

  try {
    const stripe   = getStripe();
    const response = await stripe.oauth.token({ grant_type: "authorization_code", code });
    const stripeConnectAccountId = response.stripe_user_id!;

    await connectDB();
    await PartnerProfileModel.findByIdAndUpdate(partnerId, {
      stripeConnectAccountId,
      isStripeConnected: true,
      status: "active",
    });

    return NextResponse.redirect(`${getBaseUrl()}/partner/stripe-connect?success=1`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "oauth_error";
    console.error("[stripe/connect/callback]", msg);
    return NextResponse.redirect(`${getBaseUrl()}/partner/stripe-connect?error=oauth_failed`);
  }
}
