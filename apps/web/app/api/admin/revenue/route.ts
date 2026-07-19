import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { connectDB } from "@/lib/db/connect";
import { InvoiceModel } from "@/lib/db/models/Invoice";
import { SubscriptionModel } from "@/lib/db/models/Subscription";
import { UserModel } from "@/lib/db/models/User";

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

    const [mrrResult, byPlan, monthlyRevenue, totalResult, recentInvoicesRaw] =
      await Promise.all([
        // MRR from currently-active subscriptions
        SubscriptionModel.aggregate([
          { $match: { status: "active" } },
          { $group: { _id: null, total: { $sum: "$totalThb" } } },
        ]),

        // Revenue & count by plan (active subs)
        SubscriptionModel.aggregate([
          { $match: { status: "active" } },
          {
            $group: {
              _id:     "$planId",
              count:   { $sum: 1 },
              revenue: { $sum: "$totalThb" },
            },
          },
          { $sort: { revenue: -1 } },
        ]),

        // Monthly revenue trend — last 12 months from paid invoices
        InvoiceModel.aggregate([
          { $match: { status: "paid", paidAt: { $gte: twelveMonthsAgo } } },
          {
            $group: {
              _id: {
                year:  { $year:  "$paidAt" },
                month: { $month: "$paidAt" },
              },
              revenue: { $sum: "$amountPaidThb" },
              count:   { $sum: 1 },
            },
          },
          { $sort: { "_id.year": 1, "_id.month": 1 } },
        ]),

        // All-time paid totals
        InvoiceModel.aggregate([
          { $match: { status: "paid" } },
          { $group: { _id: null, total: { $sum: "$amountPaidThb" }, count: { $sum: 1 } } },
        ]),

        // 10 most recent paid invoices
        InvoiceModel.find({ status: "paid" }).sort({ paidAt: -1 }).limit(10).lean(),
      ]);

    const mrr = mrrResult[0]?.total ?? 0;

    // Enrich recent invoices with tenant info
    const tenantIds = Array.from(new Set(recentInvoicesRaw.map((i) => i.tenantId)));
    const users = await UserModel.find({ _id: { $in: tenantIds } })
      .select("name email")
      .lean();
    const userMap = Object.fromEntries(users.map((u) => [u._id.toString(), u]));

    const recentInvoices = recentInvoicesRaw.map((inv) => ({
      _id:         inv._id,
      invoiceNumber: inv.invoiceNumber,
      amountPaidThb: inv.amountPaidThb,
      paidAt:      inv.paidAt,
      tenantName:  userMap[inv.tenantId]?.name  ?? "—",
      tenantEmail: userMap[inv.tenantId]?.email ?? "—",
    }));

    return NextResponse.json({
      mrr,
      arr:               mrr * 12,
      totalRevenue:      totalResult[0]?.total ?? 0,
      totalInvoicesPaid: totalResult[0]?.count ?? 0,
      byPlan,
      monthlyRevenue,
      recentInvoices,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "server_error";
    console.error("[admin/revenue]", msg);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
