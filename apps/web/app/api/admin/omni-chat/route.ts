/**
 * /api/admin/omni-chat
 * Admin view of the omni-channel bridge (mdw_omni_zdb_chat).
 *
 * GET ?tab=overview  → platform stats + totals
 * GET ?tab=tenants   → paginated tenant channel status list
 * GET ?tab=activity  → active (unexpired) context tokens
 *
 * PATCH              → enable/disable a platform for a specific tenant
 *                      body: { tenantId, platform, enabled: boolean }
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { connectDB } from "@/lib/db/connect";
import { TenantProfileModel } from "@/lib/db/models/TenantProfile";
import { ChannelContextTokenModel } from "@/lib/db/models/ChannelContextToken";
import { UserModel } from "@/lib/db/models/User";

function forbidden() {
  return NextResponse.json({ error: "forbidden" }, { status: 403 });
}

async function requireAdmin(req: NextRequest) {
  const token = await getServerToken(req);
  if (token?.role !== "super_admin" && token?.role !== "admin") return null;
  return token;
}

// ── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!(await requireAdmin(req))) return forbidden();

  const { searchParams } = new URL(req.url);
  const tab    = searchParams.get("tab") ?? "overview";
  const page   = Math.max(1, parseInt(searchParams.get("page")  ?? "1",  10));
  const limit  = Math.min(50, parseInt(searchParams.get("limit") ?? "20", 10));
  const search = searchParams.get("q") ?? "";
  const pf     = searchParams.get("platform") ?? "";   // filter by platform

  await connectDB();

  // ── Tab: overview ─────────────────────────────────────────────────────────
  if (tab === "overview") {
    const [
      lineConnected,
      lineEnabled,
      metaConnected,
      metaEnabled,
      tiktokConnected,
      tiktokEnabled,
      totalTenants,
      activeTokens,
    ] = await Promise.all([
      TenantProfileModel.countDocuments({ lineChannelSecret: { $exists: true, $ne: "" } }),
      TenantProfileModel.countDocuments({ lineOmniEnabled: true, lineChannelSecret: { $exists: true, $ne: "" } }),
      TenantProfileModel.countDocuments({ metaAppSecret: { $exists: true, $ne: "" } }),
      TenantProfileModel.countDocuments({ metaEnabled: true, metaAppSecret: { $exists: true, $ne: "" } }),
      TenantProfileModel.countDocuments({ tiktokAccessToken: { $exists: true, $ne: "" } }),
      TenantProfileModel.countDocuments({ tiktokEnabled: true, tiktokAccessToken: { $exists: true, $ne: "" } }),
      UserModel.countDocuments({ role: "tenant" }),
      ChannelContextTokenModel.countDocuments({ expiresAt: { $gt: new Date() } }),
    ]);

    // Token activity by platform (active tokens only)
    const tokenByPlatform = await ChannelContextTokenModel.aggregate([
      { $match: { expiresAt: { $gt: new Date() } } },
      { $group: { _id: "$platformName", count: { $sum: 1 } } },
    ]);
    const tokenPlatformMap = Object.fromEntries(
      tokenByPlatform.map((r: { _id: string; count: number }) => [r._id, r.count])
    );

    return NextResponse.json({
      totalTenants,
      activeTokens,
      platforms: {
        line:      { connected: lineConnected,    enabled: lineEnabled,    activeTokens: tokenPlatformMap["line"]      ?? 0 },
        facebook:  { connected: metaConnected,    enabled: metaEnabled,    activeTokens: tokenPlatformMap["facebook"]  ?? 0 },
        instagram: { connected: metaConnected,    enabled: metaEnabled,    activeTokens: tokenPlatformMap["instagram"] ?? 0 },
        tiktok:    { connected: tiktokConnected,  enabled: tiktokEnabled,  activeTokens: tokenPlatformMap["tiktok"]    ?? 0 },
      },
    });
  }

  // ── Tab: tenants ──────────────────────────────────────────────────────────
  if (tab === "tenants") {
    const profileFilter: Record<string, unknown> = {};

    // Platform filter
    if (pf === "line")      profileFilter.lineChannelSecret  = { $exists: true, $ne: "" };
    if (pf === "meta")      profileFilter.metaAppSecret      = { $exists: true, $ne: "" };
    if (pf === "tiktok")    profileFilter.tiktokAccessToken  = { $exists: true, $ne: "" };

    // Search by tenantId or businessName
    if (search) {
      profileFilter.$or = [
        { tenantId:     { $regex: search, $options: "i" } },
        { businessName: { $regex: search, $options: "i" } },
        { websiteUrl:   { $regex: search, $options: "i" } },
      ];
    }

    const total    = await TenantProfileModel.countDocuments(profileFilter);
    const profiles = await TenantProfileModel
      .find(profileFilter)
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select([
        "tenantId", "businessName", "websiteUrl", "botName",
        "lineOmniEnabled",  "lineChannelSecret",  "lineChannelToken",  "lineLiffId",
        "metaEnabled",      "metaAppSecret",      "metaPageAccessToken","metaPageId", "metaVerifyToken",
        "tiktokEnabled",    "tiktokAccessToken",  "tiktokWebhookSecret",
      ].join(" "))
      .lean();

    // Get email for each tenant from User collection
    const tenantIds = profiles.map((p) => p.tenantId);
    const users = await UserModel
      .find({ _id: { $in: tenantIds } })
      .select("_id email")
      .lean();
    const emailMap = Object.fromEntries(users.map((u) => [u._id.toString(), u.email]));

    const rows = profiles.map((p) => ({
      tenantId:     p.tenantId,
      businessName: p.businessName ?? "",
      websiteUrl:   p.websiteUrl   ?? "",
      botName:      p.botName      ?? "",
      email:        emailMap[p.tenantId] ?? "",
      line: {
        enabled:   p.lineOmniEnabled ?? false,
        connected: Boolean(p.lineChannelSecret),
        hasToken:  Boolean(p.lineChannelToken),
        liffId:    p.lineLiffId ?? "",
      },
      meta: {
        enabled:    p.metaEnabled ?? false,
        connected:  Boolean(p.metaAppSecret),
        hasToken:   Boolean(p.metaPageAccessToken),
        pageId:     p.metaPageId ?? "",
        verifySet:  Boolean(p.metaVerifyToken),
      },
      tiktok: {
        enabled:   p.tiktokEnabled ?? false,
        connected: Boolean(p.tiktokAccessToken),
        hasSecret: Boolean(p.tiktokWebhookSecret),
      },
    }));

    return NextResponse.json({ total, page, limit, rows });
  }

  // ── Tab: activity (live tokens) ───────────────────────────────────────────
  if (tab === "activity") {
    const tokenFilter: Record<string, unknown> = { expiresAt: { $gt: new Date() } };
    if (pf)     tokenFilter.platformName = pf;
    if (search) tokenFilter.tenantId     = { $regex: search, $options: "i" };

    const total  = await ChannelContextTokenModel.countDocuments(tokenFilter);
    const tokens = await ChannelContextTokenModel
      .find(tokenFilter)
      .sort({ expiresAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select("tenantId platformName displayName initialMessage expiresAt")
      .lean();

    // Enrich with businessName
    const tids   = Array.from(new Set(tokens.map((t) => t.tenantId)));
    const profs  = await TenantProfileModel.find({ tenantId: { $in: tids } }).select("tenantId businessName").lean();
    const nameMap = Object.fromEntries(profs.map((p) => [p.tenantId, p.businessName ?? p.tenantId]));

    const rows = tokens.map((t) => ({
      tenantId:       t.tenantId,
      businessName:   nameMap[t.tenantId] ?? t.tenantId,
      platformName:   t.platformName,
      displayName:    t.displayName ?? "",
      initialMessage: t.initialMessage,
      expiresAt:      t.expiresAt,
    }));

    return NextResponse.json({ total, page, limit, rows });
  }

  return NextResponse.json({ error: "unknown_tab" }, { status: 400 });
}

// ── PATCH — toggle platform enable/disable for a tenant ──────────────────────

export async function PATCH(req: NextRequest) {
  if (!(await requireAdmin(req))) return forbidden();

  let body: { tenantId?: string; platform?: string; enabled?: boolean };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid_body" }, { status: 400 }); }

  const { tenantId, platform, enabled } = body;
  if (!tenantId || !platform || typeof enabled !== "boolean") {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const fieldMap: Record<string, string> = {
    line:     "lineOmniEnabled",
    facebook: "metaEnabled",
    meta:     "metaEnabled",
    tiktok:   "tiktokEnabled",
  };
  const field = fieldMap[platform];
  if (!field) return NextResponse.json({ error: "unknown_platform" }, { status: 400 });

  await connectDB();
  await TenantProfileModel.updateOne({ tenantId }, { $set: { [field]: enabled } });
  return NextResponse.json({ ok: true });
}
