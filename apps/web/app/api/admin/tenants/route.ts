import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { connectDB } from "@/lib/db/connect";
import { UserModel } from "@/lib/db/models/User";
import { SubscriptionModel } from "@/lib/db/models/Subscription";
import { TenantProfileModel } from "@/lib/db/models/TenantProfile";

export async function GET(req: NextRequest) {
  const token = await getServerToken(req);
  if (token?.role !== "super_admin" && token?.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const page   = Math.max(1, parseInt(searchParams.get("page")  ?? "1", 10));
  const limit  = Math.min(50, parseInt(searchParams.get("limit") ?? "20", 10));
  const search = searchParams.get("q") ?? "";
  const state  = searchParams.get("state") ?? "";

  try {
    await connectDB();

    const filter: Record<string, unknown> = { role: "tenant" };
    if (search) {
      filter.$or = [
        { email: { $regex: search, $options: "i" } },
        { name:  { $regex: search, $options: "i" } },
      ];
    }
    if (state) filter.botState = state;

    const total = await UserModel.countDocuments(filter);
    const users = await UserModel
      .find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select("-passwordHash");

    // Enrich with subscription + profile
    const tenantIds = users.map((u) => u._id.toString());
    const [subs, profiles] = await Promise.all([
      SubscriptionModel.find({ tenantId: { $in: tenantIds } }),
      TenantProfileModel.find({ tenantId: { $in: tenantIds } }),
    ]);
    const subMap     = Object.fromEntries(subs.map((s) => [s.tenantId, s]));
    const profileMap = Object.fromEntries(profiles.map((p) => [p.tenantId, p]));

    const tenants = users.map((u) => {
      const id  = u._id.toString();
      const sub = subMap[id];
      const prof= profileMap[id];
      return {
        id,
        email:              u.email,
        name:               u.name,
        botState:           u.botState,
        trialEndsAt:        u.trialEndsAt,
        onboardingComplete: u.onboardingComplete,
        createdAt:          u.createdAt,
        planId:             sub?.planId ?? "trial",
        subStatus:          sub?.status ?? "trialing",
        readyPackageName:   sub?.readyPackageName ?? "",
        businessName:       prof?.businessName ?? "",
        dailyMsgCount:      prof?.dailyMessageCount ?? 0,
        pendingDeleteAt:    u.pendingDeleteAt ?? null,
        deletedByAdmin:     u.deletedByAdmin ?? false,
      };
    });

    return NextResponse.json({ tenants, total, page, limit });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "server_error";
    console.error("[admin/tenants]", msg);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
