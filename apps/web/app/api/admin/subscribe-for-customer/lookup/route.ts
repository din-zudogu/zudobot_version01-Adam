/**
 * GET /api/admin/subscribe-for-customer/lookup?email=xxx
 * Resolve an existing tenant by their Google-account email so an admin/partner
 * can subscribe a paid plan on their behalf. Never creates an account.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { connectDB } from "@/lib/db/connect";
import { UserModel } from "@/lib/db/models/User";
import { SubscriptionModel } from "@/lib/db/models/Subscription";
import { PartnerProfileModel } from "@/lib/db/models/PartnerProfile";

function requireAllowedRole(role?: string) {
  return role === "admin" || role === "super_admin" || role === "partner_admin";
}

export async function GET(req: NextRequest) {
  const token = await getServerToken(req);
  if (!requireAllowedRole(token?.role as string)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const email = req.nextUrl.searchParams.get("email")?.trim().toLowerCase() ?? "";
  if (!email.includes("@")) {
    return NextResponse.json({ found: false });
  }

  try {
    await connectDB();

    const user = await UserModel.findOne({ email, role: "tenant" })
      .select("name email")
      .lean() as { _id: { toString(): string }; name?: string; email: string } | null;

    if (!user) return NextResponse.json({ found: false });

    const tenantId = user._id.toString();

    // partner_admin may only subscribe tenants they already own
    if (token!.role === "partner_admin") {
      const partner = await PartnerProfileModel.findOne({ userId: token!.sub }).lean();
      if (!partner) return NextResponse.json({ found: false });
      const owned = await SubscriptionModel.exists({
        tenantId,
        referredByPartnerId: (partner._id as { toString(): string }).toString(),
      });
      if (!owned) return NextResponse.json({ found: false });
    }

    const sub = await SubscriptionModel.findOne({ tenantId })
      .select("planId status")
      .lean() as { planId?: string; status?: string } | null;

    return NextResponse.json({
      found:          true,
      tenantId,
      name:           user.name ?? "",
      email:          user.email,
      currentPlanId:  sub?.planId ?? "trial",
      currentStatus:  sub?.status ?? "trialing",
    });
  } catch {
    return NextResponse.json({ found: false });
  }
}
