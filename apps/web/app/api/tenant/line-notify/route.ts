/**
 * /api/tenant/line-notify
 * Dashboard proxy for LINE Messaging API settings.
 * Auth: Firebase JWT (tenant role)
 *
 * GET    — returns connection status
 * PATCH  — { lineChannelSecret?, lineChannelToken?, lineEnabled? }
 * POST   — send test push notification
 * DELETE — disconnect LINE
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getServerToken } from "@/lib/auth/getServerToken";
import { connectDB } from "@/lib/db/connect";
import { TenantProfileModel } from "@/lib/db/models/TenantProfile";
import { testLinePush } from "@/lib/services/lineNotify";

function unauth() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

function generateConnectCode(): string {
  const num = crypto.randomInt(1000, 9999);
  return `CONNECT-${num}`;
}

// ── GET ────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const token = await getServerToken(req);
  if (!token?.sub || token.role !== "tenant") return unauth();

  await connectDB();
  const profile = await TenantProfileModel.findOne({ tenantId: token.sub })
    .select("lineEnabled lineChannelToken lineChannelSecret lineUserId lineConnectCode embedKey")
    .lean();

  return NextResponse.json({
    tenantId:         token.sub,
    lineEnabled:      profile?.lineEnabled      ?? false,
    hasChannelToken:  Boolean(profile?.lineChannelToken),
    hasChannelSecret: Boolean(profile?.lineChannelSecret),
    hasUserId:        Boolean(profile?.lineUserId),
    lineConnectCode:  profile?.lineConnectCode  ?? "",
    embedKey:         profile?.embedKey         ?? "",
    tokenPreview: profile?.lineChannelToken
      ? `••••••••${profile.lineChannelToken.slice(-4)}`
      : null,
    userIdPreview: profile?.lineUserId
      ? `${profile.lineUserId.slice(0, 4)}••••`
      : null,
  });
}

// ── PATCH ──────────────────────────────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  const token = await getServerToken(req);
  if (!token?.sub || token.role !== "tenant") return unauth();

  let body: { lineChannelSecret?: string; lineChannelToken?: string; lineEnabled?: boolean };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid_body" }, { status: 400 }); }

  const update: Record<string, unknown> = {};
  if (typeof body.lineChannelSecret === "string") update.lineChannelSecret = body.lineChannelSecret.trim();
  if (typeof body.lineChannelToken  === "string") update.lineChannelToken  = body.lineChannelToken.trim();
  if (typeof body.lineEnabled       === "boolean") update.lineEnabled      = body.lineEnabled;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "nothing_to_update" }, { status: 400 });
  }

  await connectDB();

  // Re-generate connect code when credentials change
  if (update.lineChannelSecret || update.lineChannelToken) {
    const existing = await TenantProfileModel.findOne({ tenantId: token.sub })
      .select("lineChannelSecret lineChannelToken").lean();
    const hasSecret = update.lineChannelSecret || existing?.lineChannelSecret;
    const hasToken  = update.lineChannelToken  || existing?.lineChannelToken;
    if (hasSecret && hasToken) {
      update.lineConnectCode = generateConnectCode();
      update.lineUserId      = "";
      update.lineEnabled     = false;
    }
  }

  await TenantProfileModel.updateOne({ tenantId: token.sub }, { $set: update });

  const updated = await TenantProfileModel.findOne({ tenantId: token.sub })
    .select("lineConnectCode").lean();

  return NextResponse.json({ ok: true, lineConnectCode: updated?.lineConnectCode ?? "" });
}

// ── POST — send test push notification ────────────────────────────────────

export async function POST(req: NextRequest) {
  const token = await getServerToken(req);
  if (!token?.sub || token.role !== "tenant") return unauth();

  await connectDB();
  const profile = await TenantProfileModel.findOne({ tenantId: token.sub })
    .select("lineChannelToken lineUserId botName lineEnabled")
    .lean();

  if (!profile?.lineChannelToken) {
    return NextResponse.json({ error: "no_token" }, { status: 400 });
  }
  if (!profile?.lineUserId) {
    return NextResponse.json({ error: "not_connected" }, { status: 400 });
  }

  const result = await testLinePush(
    profile.lineChannelToken,
    profile.lineUserId,
    profile.botName || "Zudobot Shop"
  );

  if (!result.ok) {
    const httpStatus = result.status === 401 ? 401 : 502;
    return NextResponse.json(
      { error: result.lineError ?? "line_api_error", lineStatus: result.status },
      { status: httpStatus }
    );
  }

  return NextResponse.json({ ok: true });
}

// ── DELETE — disconnect LINE ───────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  const token = await getServerToken(req);
  if (!token?.sub || token.role !== "tenant") return unauth();

  await connectDB();
  await TenantProfileModel.updateOne(
    { tenantId: token.sub },
    { $set: {
      lineEnabled:       false,
      lineChannelSecret: "",
      lineChannelToken:  "",
      lineUserId:        "",
      lineConnectCode:   "",
    }}
  );

  return NextResponse.json({ ok: true });
}
