/**
 * GET /api/admin/subscribe-for-customer/status?session_id=xxx
 * Polled by the admin/partner "waiting for payment" screen to reflect
 * PromptPay payment status in near real time.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { connectDB } from "@/lib/db/connect";
import { SubscriptionModel } from "@/lib/db/models/Subscription";
import { getStripe } from "@/lib/stripe/client";

function requireAllowedRole(role?: string) {
  return role === "admin" || role === "super_admin" || role === "partner_admin";
}

export async function GET(req: NextRequest) {
  const token = await getServerToken(req);
  if (!requireAllowedRole(token?.role as string)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const sessionId = req.nextUrl.searchParams.get("session_id") ?? "";
  if (!sessionId) {
    return NextResponse.json({ error: "missing_session_id" }, { status: 400 });
  }

  try {
    const stripe  = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const tenantId = session.metadata?.tenantId;

    await connectDB();
    const sub = tenantId
      ? await SubscriptionModel.findOne({ tenantId })
          .select("status planId currentPeriodEnd")
          .lean() as { status?: string; planId?: string; currentPeriodEnd?: Date } | null
      : null;

    return NextResponse.json({
      paymentStatus:      session.payment_status,
      subscriptionStatus: sub?.status ?? null,
      planId:             sub?.planId ?? null,
      currentPeriodEnd:   sub?.currentPeriodEnd ?? null,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "stripe_error";
    return NextResponse.json({ error: "stripe_error", detail: msg }, { status: 500 });
  }
}
