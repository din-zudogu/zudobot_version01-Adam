import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { connectDB } from "@/lib/db/connect";
import { UserModel } from "@/lib/db/models/User";
import { TenantProfileModel } from "@/lib/db/models/TenantProfile";
import { SubscriptionModel } from "@/lib/db/models/Subscription";

export async function GET(req: NextRequest) {
  const token = await getServerToken(req);
  if (token?.role !== "super_admin" && token?.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    await connectDB();

    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
    twelveMonthsAgo.setDate(1);
    twelveMonthsAgo.setHours(0, 0, 0, 0);

    const [
      totalTenants,
      totalAdmins,
      activeSubs,
      botStateDist,
      msgResult,
      topProfiles,
      monthlySignups,
    ] = await Promise.all([
      UserModel.countDocuments({ role: "tenant" }),
      UserModel.countDocuments({ role: { $in: ["admin", "super_admin"] } }),
      SubscriptionModel.countDocuments({ status: "active" }),

      UserModel.aggregate([
        { $match: { role: "tenant" } },
        { $group: { _id: "$botState", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),

      TenantProfileModel.aggregate([
        { $group: { _id: null, total: { $sum: "$totalMessageCount" } } },
      ]),

      TenantProfileModel.find().sort({ totalMessageCount: -1 }).limit(10).lean(),

      UserModel.aggregate([
        { $match: { role: "tenant", createdAt: { $gte: twelveMonthsAgo } } },
        {
          $group: {
            _id: {
              year:  { $year:  "$createdAt" },
              month: { $month: "$createdAt" },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
      ]),
    ]);

    // Enrich top tenants with user info
    const topTenantIds = topProfiles.map((p) => p.tenantId);
    const topUsers = await UserModel.find({ _id: { $in: topTenantIds } })
      .select("name email")
      .lean();
    const userMap = Object.fromEntries(topUsers.map((u) => [u._id.toString(), u]));

    const topTenants = topProfiles.map((p) => ({
      tenantId:      p.tenantId,
      name:          userMap[p.tenantId]?.name  ?? "—",
      email:         userMap[p.tenantId]?.email ?? "—",
      totalMessages: p.totalMessageCount,
      dailyMessages: p.dailyMessageCount,
    }));

    return NextResponse.json({
      totals: {
        tenants:             totalTenants,
        admins:              totalAdmins,
        activeSubscriptions: activeSubs,
        totalMessages:       msgResult[0]?.total ?? 0,
      },
      botStateDistribution: botStateDist,
      topTenants,
      monthlySignups,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "server_error";
    console.error("[admin/analytics]", msg);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
