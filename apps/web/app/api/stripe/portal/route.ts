import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { connectDB } from "@/lib/db/connect";
import { SubscriptionModel } from "@/lib/db/models/Subscription";
import { createPortalSession } from "@/lib/stripe/helpers";

export async function POST(req: NextRequest) {
  const token = await getServerToken(req);
  if (!token?.sub || token.role !== "tenant") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();
    const sub = await SubscriptionModel.findOne({ tenantId: token.sub });

    if (!sub?.stripeCustomerId) {
      return NextResponse.json({ error: "no_subscription" }, { status: 404 });
    }

    const url = await createPortalSession(sub.stripeCustomerId);
    return NextResponse.json({ url });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "stripe_error";
    console.error("[stripe/portal]", msg);
    return NextResponse.json({ error: "stripe_error" }, { status: 500 });
  }
}
