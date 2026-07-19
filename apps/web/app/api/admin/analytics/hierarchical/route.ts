/**
 * GET /api/admin/analytics/hierarchical
 *
 * Returns multi-level analytics for admin. Query params:
 *   granularity = "global" | "by_partner" | "partner_tenants" | "direct"
 *   partnerId   = PartnerProfile._id  (required when granularity = "partner_tenants")
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { connectDB } from "@/lib/db/connect";
import { UserModel } from "@/lib/db/models/User";
import { TenantProfileModel } from "@/lib/db/models/TenantProfile";
import { SubscriptionModel } from "@/lib/db/models/Subscription";
import { PartnerProfileModel } from "@/lib/db/models/PartnerProfile";

export async function GET(req: NextRequest) {
  const token = await getServerToken(req);
  if (token?.role !== "super_admin" && token?.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const granularity = searchParams.get("granularity") ?? "global";
  const partnerIdQ  = searchParams.get("partnerId");

  try {
    await connectDB();

  // ── Global summary ─────────────────────────────────────────────────────────
  if (granularity === "global") {
    const [
      totalTenants,
      totalPartners,
      activePartnerSubs,
      directSubs,
      msgResult,
      botStateDist,
    ] = await Promise.all([
      UserModel.countDocuments({ role: "tenant" }),
      PartnerProfileModel.countDocuments({ status: "active" }),
      SubscriptionModel.countDocuments({ referredByPartnerId: { $exists: true }, status: "active" }),
      SubscriptionModel.countDocuments({ referredByPartnerId: { $exists: false }, status: "active" }),
      TenantProfileModel.aggregate([
        { $group: { _id: null, daily: { $sum: "$dailyMessageCount" }, monthly: { $sum: "$monthlyMessageCount" }, total: { $sum: "$totalMessageCount" } } },
      ]),
      UserModel.aggregate([
        { $match: { role: "tenant" } },
        { $group: { _id: "$botState", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
    ]);

    return NextResponse.json({
      granularity: "global",
      totals: {
        tenants:         totalTenants,
        partners:        totalPartners,
        partnerSubs:     activePartnerSubs,
        directSubs,
        dailyMessages:   msgResult[0]?.daily   ?? 0,
        monthlyMessages: msgResult[0]?.monthly ?? 0,
        totalMessages:   msgResult[0]?.total   ?? 0,
      },
      botStateDistribution: botStateDist,
    });
  }

  // ── Per-partner breakdown ─────────────────────────────────────────────────
  if (granularity === "by_partner") {
    const partners = await PartnerProfileModel.find().select("_id companyName email status totalActiveSlots").lean();

    const partnerIds = partners.map((p) => p._id.toString());
    const subsByPartner = await SubscriptionModel.aggregate([
      { $match: { referredByPartnerId: { $in: partnerIds } } },
      { $group: { _id: "$referredByPartnerId", count: { $sum: 1 }, activeCount: { $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] } } } },
    ]);

    // Message totals per partner — via tenant profiles
    const tenantsByPartner = await SubscriptionModel.aggregate([
      { $match: { referredByPartnerId: { $in: partnerIds } } },
      { $group: { _id: "$referredByPartnerId", tenantIds: { $push: "$tenantId" } } },
    ]);
    const partnerTenantMap: Record<string, string[]> = {};
    for (const r of tenantsByPartner) {
      partnerTenantMap[r._id as string] = r.tenantIds as string[];
    }

    const msgByPartner: Record<string, { daily: number; monthly: number; total: number }> = {};
    for (const [pid, tids] of Object.entries(partnerTenantMap)) {
      const agg = await TenantProfileModel.aggregate([
        { $match: { tenantId: { $in: tids } } },
        { $group: { _id: null, daily: { $sum: "$dailyMessageCount" }, monthly: { $sum: "$monthlyMessageCount" }, total: { $sum: "$totalMessageCount" } } },
      ]);
      msgByPartner[pid] = agg[0] ?? { daily: 0, monthly: 0, total: 0 };
    }

    const subMap = Object.fromEntries(subsByPartner.map((s) => [s._id as string, s]));

    const rows = partners.map((p) => {
      const pid  = p._id.toString();
      const subs = subMap[pid] ?? { count: 0, activeCount: 0 };
      const msgs = msgByPartner[pid] ?? { daily: 0, monthly: 0, total: 0 };
      return {
        partnerId:      pid,
        companyName:    p.companyName,
        email:          p.email,
        status:         p.status,
        totalSlots:     subs.count,
        activeSlots:    subs.activeCount,
        dailyMessages:  msgs.daily,
        monthlyMessages:msgs.monthly,
        totalMessages:  msgs.total,
      };
    });
    rows.sort((a, b) => b.monthlyMessages - a.monthlyMessages);

    return NextResponse.json({ granularity: "by_partner", partners: rows });
  }

  // ── Tenants under a specific partner ────────────────────────────────────
  if (granularity === "partner_tenants" && partnerIdQ) {
    const subs = await SubscriptionModel
      .find({ referredByPartnerId: partnerIdQ })
      .select("tenantId planId status partnerProvisioned totalThb")
      .lean();

    const tenantIds = subs.map((s) => s.tenantId);
    const [profiles, users] = await Promise.all([
      TenantProfileModel.find({ tenantId: { $in: tenantIds } }).select("tenantId businessName dailyMessageCount monthlyMessageCount totalMessageCount").lean(),
      UserModel.find({ _id: { $in: tenantIds } }).select("_id email name botState createdAt").lean(),
    ]);

    const profileMap = Object.fromEntries(profiles.map((p) => [p.tenantId, p]));
    const userMap    = Object.fromEntries(users.map((u) => [u._id.toString(), u]));

    const tenants = subs.map((s) => {
      const p = profileMap[s.tenantId];
      const u = userMap[s.tenantId];
      return {
        tenantId:            s.tenantId,
        businessName:        p?.businessName ?? u?.name ?? "—",
        email:               u?.email ?? "—",
        botState:            u?.botState ?? "unknown",
        planId:              s.planId,
        subStatus:           s.status,
        partnerProvisioned:  s.partnerProvisioned,
        dailyMessageCount:   p?.dailyMessageCount   ?? 0,
        monthlyMessageCount: p?.monthlyMessageCount ?? 0,
        totalMessageCount:   p?.totalMessageCount   ?? 0,
        createdAt:           u?.createdAt,
      };
    });
    tenants.sort((a, b) => b.monthlyMessageCount - a.monthlyMessageCount);

    return NextResponse.json({ granularity: "partner_tenants", partnerId: partnerIdQ, tenants });
  }

  // ── Direct tenants (no partner) ───────────────────────────────────────────
  if (granularity === "direct") {
    const directSubs = await SubscriptionModel
      .find({ referredByPartnerId: { $exists: false } })
      .select("tenantId planId status totalThb")
      .lean();

    const tenantIds = directSubs.map((s) => s.tenantId);
    const [profiles, users] = await Promise.all([
      TenantProfileModel.find({ tenantId: { $in: tenantIds } }).select("tenantId businessName dailyMessageCount monthlyMessageCount totalMessageCount").lean(),
      UserModel.find({ _id: { $in: tenantIds } }).select("_id email name botState createdAt").lean(),
    ]);

    const profileMap = Object.fromEntries(profiles.map((p) => [p.tenantId, p]));
    const userMap    = Object.fromEntries(users.map((u) => [u._id.toString(), u]));

    const tenants = directSubs.map((s) => {
      const p = profileMap[s.tenantId];
      const u = userMap[s.tenantId];
      return {
        tenantId:            s.tenantId,
        businessName:        p?.businessName ?? u?.name ?? "—",
        email:               u?.email ?? "—",
        botState:            u?.botState ?? "unknown",
        planId:              s.planId,
        subStatus:           s.status,
        dailyMessageCount:   p?.dailyMessageCount   ?? 0,
        monthlyMessageCount: p?.monthlyMessageCount ?? 0,
        totalMessageCount:   p?.totalMessageCount   ?? 0,
        createdAt:           u?.createdAt,
      };
    });
    tenants.sort((a, b) => b.monthlyMessageCount - a.monthlyMessageCount);

    return NextResponse.json({ granularity: "direct", tenants });
  }

    return NextResponse.json({ error: "invalid_granularity" }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "server_error";
    console.error("[admin/analytics/hierarchical]", msg);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
