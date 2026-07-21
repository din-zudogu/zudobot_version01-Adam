/**
 * GET /api/admin/accounts
 *
 * Unified list of every email that has ever transacted on the site — union of
 * User, PartnerProfile.email (can exist without a User doc — invited-only),
 * and VipTenant.email. Each row reports what the email is FOR (tenant/partner/
 * vip/admin — can be more than one) and its status per that type.
 *
 * Query params: q (email substring), type (post-filter: tenant|partner|vip|admin),
 * page, limit.
 */
import { NextRequest, NextResponse } from "next/server";
import type { PipelineStage } from "mongoose";
import { getServerToken } from "@/lib/auth/getServerToken";
import { connectDB } from "@/lib/db/connect";
import { UserModel } from "@/lib/db/models/User";
import { PartnerProfileModel } from "@/lib/db/models/PartnerProfile";
import { VipTenantModel } from "@/lib/db/models/VipTenant";
import { SystemLogModel } from "@/lib/db/models/SystemLog";

type AccountType = "tenant" | "partner" | "vip" | "admin" | "pending";

export async function GET(req: NextRequest) {
  const token = await getServerToken(req);
  if (token?.role !== "super_admin" && token?.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const q      = searchParams.get("q")?.trim().toLowerCase() ?? "";
  const type   = searchParams.get("type") as AccountType | null;
  const page   = Math.max(1, parseInt(searchParams.get("page")  ?? "1", 10));
  const limit  = Math.min(50, parseInt(searchParams.get("limit") ?? "20", 10));

  await connectDB();

  // ── Phase 1: dedupe + paginate the union of emails across 4 sources ──────
  // Includes emails that never got a User/Partner/Vip doc at all — e.g. a
  // Google sign-in that never completed onboarding (deferred user creation
  // means nothing is persisted for it except this log entry).
  const pipeline: PipelineStage[] = [
    { $project: { _id: 0, email: { $toLower: "$email" } } },
    { $unionWith: { coll: "partnerprofiles", pipeline: [{ $project: { _id: 0, email: { $toLower: "$email" } } }] } },
    { $unionWith: { coll: "viptenants",      pipeline: [{ $project: { _id: 0, email: { $toLower: "$email" } } }] } },
    {
      $unionWith: {
        coll: "systemlogs",
        pipeline: [
          { $match: { category: "auth", action: "pending_registration_started", email: { $exists: true } } },
          { $project: { _id: 0, email: { $toLower: "$email" } } },
        ],
      },
    },
  ];
  if (q) pipeline.push({ $match: { email: { $regex: q, $options: "i" } } });
  pipeline.push(
    { $group: { _id: "$email" } },
    { $sort: { _id: 1 } },
    {
      $facet: {
        total: [{ $count: "n" }],
        page:  [{ $skip: (page - 1) * limit }, { $limit: limit }],
      },
    },
  );

  const [facetResult] = await UserModel.aggregate(pipeline);
  const total  = facetResult?.total?.[0]?.n ?? 0;
  const emails: string[] = (facetResult?.page ?? []).map((r: { _id: string }) => r._id).filter(Boolean);

  if (emails.length === 0) {
    return NextResponse.json({ accounts: [], total: 0, page, limit });
  }

  // ── Phase 2: batch-fetch + enrich ──────────────────────────────────────────
  const [users, partners, vips, pendingAgg] = await Promise.all([
    UserModel.find({ email: { $in: emails } }).lean(),
    PartnerProfileModel.find({ email: { $in: emails } }).select("-inviteToken -verifyCode").lean(),
    VipTenantModel.find({ email: { $in: emails } }).lean(),
    SystemLogModel.aggregate([
      { $match: { category: "auth", action: "pending_registration_started", email: { $in: emails } } },
      { $group: { _id: "$email", attempts: { $sum: 1 }, lastAttemptAt: { $max: "$createdAt" } } },
    ]),
  ]);

  const userByEmail    = Object.fromEntries(users.map((u) => [u.email.toLowerCase(), u]));
  const partnerByEmail = Object.fromEntries(partners.map((p) => [p.email.toLowerCase(), p]));
  const vipByEmail     = Object.fromEntries(vips.map((v) => [v.email.toLowerCase(), v]));
  const pendingByEmail = Object.fromEntries(
    pendingAgg.map((p: { _id: string; attempts: number; lastAttemptAt: Date }) => [p._id, p])
  );

  let accounts = emails.map((email) => {
    const user    = userByEmail[email] as (typeof users)[number] | undefined;
    const partner = partnerByEmail[email] as (typeof partners)[number] | undefined;
    const vip     = vipByEmail[email] as (typeof vips)[number] | undefined;
    const pending = pendingByEmail[email] as { attempts: number; lastAttemptAt: Date } | undefined;

    const types: AccountType[] = [];
    if (user && (user.role === "tenant" || (user.roles ?? []).includes("tenant"))) types.push("tenant");
    if (partner || user?.role === "partner_admin" || (user?.roles ?? []).includes("partner_admin")) types.push("partner");
    if (vip) types.push("vip");
    if (user && (user.role === "admin" || user.role === "super_admin")) types.push("admin");
    // Only surface as "pending" when no real account exists at all — an email
    // that later completed signup keeps its old pending_registration_started
    // log rows, but shouldn't show a stale "pending" badge once it has a real type.
    if (types.length === 0 && pending) types.push("pending");

    return {
      email,
      userId:    user?._id?.toString(),
      createdAt: user?.createdAt ?? partner?.createdAt ?? vip?.createdAt ?? pending?.lastAttemptAt,
      types,
      pending: types.includes("pending") && pending ? {
        attempts:      pending.attempts,
        lastAttemptAt: pending.lastAttemptAt,
      } : undefined,
      tenant: types.includes("tenant") && user ? {
        botState:        user.botState,
        trialEndsAt:     user.trialEndsAt,
        pendingDeleteAt: user.pendingDeleteAt,
        deletedByAdmin:  user.deletedByAdmin,
      } : undefined,
      partner: partner ? {
        partnerId:       partner._id.toString(),
        status:           partner.status,
        isOrphaned:       !partner.userId || partner.userId.startsWith("pending_"),
        pendingDeleteAt:  partner.pendingDeleteAt,
      } : (user?.role === "partner_admin" || (user?.roles ?? []).includes("partner_admin")) && user ? {
        partnerId: undefined,
        status:    "active",
        isOrphaned: true,
        pendingDeleteAt: undefined,
      } : undefined,
      vip: vip ? {
        vipId:    vip._id.toString(),
        isActive: vip.isActive,
        endDate:  vip.endDate,
        label:    vip.label,
      } : undefined,
      admin: user && (user.role === "admin" || user.role === "super_admin") ? { role: user.role } : undefined,
    };
  });

  if (type) {
    accounts = accounts.filter((a) => a.types.includes(type));
  }

  return NextResponse.json({ accounts, total, page, limit });
}
