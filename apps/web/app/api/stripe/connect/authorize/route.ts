import { NextRequest, NextResponse } from "next/server";
import { getPartnerToken } from "@/lib/auth/getPartnerToken";
import { connectDB } from "@/lib/db/connect";
import { PartnerProfileModel } from "@/lib/db/models/PartnerProfile";
import { buildStripeConnectUrl } from "@/lib/stripe/partnerHelpers";

/** Redirect partner to Stripe Connect OAuth. */
export async function GET(req: NextRequest) {
  const token = await getPartnerToken(req);
  if (!token) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  await connectDB();
  const partner = await PartnerProfileModel.findOne({ userId: token.sub }).lean();
  if (!partner) return NextResponse.json({ error: "partner_not_found" }, { status: 404 });
  if (partner.isStripeConnected) {
    return NextResponse.json({ error: "already_connected" }, { status: 409 });
  }

  const url = buildStripeConnectUrl(partner._id.toString());
  return NextResponse.redirect(url);
}
