/**
 * /api/tenant/channels
 * Omni-channel integration settings for LINE / Facebook / Instagram / TikTok.
 *
 * GET    — returns current status (credentials masked, booleans only)
 * PATCH  — save credentials for one platform at a time
 * DELETE — disconnect a platform { platform: "line" | "facebook" | "tiktok" }
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { connectDB } from "@/lib/db/connect";
import { TenantProfileModel } from "@/lib/db/models/TenantProfile";

function unauth() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

function mask(val: string | undefined | null): string | null {
  if (!val) return null;
  if (val.length <= 8) return "••••••••";
  return `••••••••${val.slice(-4)}`;
}

// ── GET ─────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const token = await getServerToken(req);
  if (!token?.sub || token.role !== "tenant") return unauth();

  await connectDB();
  const p = await TenantProfileModel.findOne({ tenantId: token.sub })
    .select([
      "tenantId",
      "allowedDomain",
      "lineOmniEnabled","lineChannelSecret","lineChannelToken","lineLiffId",
      "metaEnabled","metaAppSecret","metaPageAccessToken","metaPageId","metaVerifyToken",
      "tiktokEnabled","tiktokAccessToken","tiktokWebhookSecret",
    ].join(" "))
    .lean();

  if (!p) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://zudobot.zudogu.com";

  return NextResponse.json({
    allowedDomain: p.allowedDomain ?? "",
    line: {
      enabled:            p.lineOmniEnabled  ?? false,
      hasChannelSecret:   Boolean(p.lineChannelSecret),
      hasChannelToken:    Boolean(p.lineChannelToken),
      channelSecretMask:  mask(p.lineChannelSecret),
      channelTokenMask:   mask(p.lineChannelToken),
      liffId:             p.lineLiffId ?? "",
      webhookUrl:         `${baseUrl}/api/webhooks/line/${token.sub}`,
    },
    meta: {
      enabled:               p.metaEnabled        ?? false,
      hasAppSecret:          Boolean(p.metaAppSecret),
      hasPageAccessToken:    Boolean(p.metaPageAccessToken),
      appSecretMask:         mask(p.metaAppSecret),
      pageAccessTokenMask:   mask(p.metaPageAccessToken),
      pageId:                p.metaPageId          ?? "",
      verifyToken:           p.metaVerifyToken     ?? "",
      webhookUrl:            `${baseUrl}/api/webhooks/meta/${token.sub}`,
    },
    tiktok: {
      enabled:               p.tiktokEnabled       ?? false,
      hasAccessToken:        Boolean(p.tiktokAccessToken),
      hasWebhookSecret:      Boolean(p.tiktokWebhookSecret),
      accessTokenMask:       mask(p.tiktokAccessToken),
      webhookSecretMask:     mask(p.tiktokWebhookSecret),
      webhookUrl:            `${baseUrl}/api/webhooks/tiktok/${token.sub}`,
    },
  });
}

// ── PATCH ────────────────────────────────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  const token = await getServerToken(req);
  if (!token?.sub || token.role !== "tenant") return unauth();

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid_body" }, { status: 400 }); }

  const update: Record<string, unknown> = {};

  // LINE
  if (typeof body.lineOmniEnabled   === "boolean") update.lineOmniEnabled   = body.lineOmniEnabled;
  if (typeof body.lineChannelSecret === "string")  update.lineChannelSecret  = body.lineChannelSecret.trim();
  if (typeof body.lineChannelToken  === "string")  update.lineChannelToken   = body.lineChannelToken.trim();
  if (typeof body.lineLiffId        === "string")  update.lineLiffId         = body.lineLiffId.trim();

  // Meta (Facebook + Instagram)
  if (typeof body.metaEnabled          === "boolean") update.metaEnabled         = body.metaEnabled;
  if (typeof body.metaAppSecret        === "string")  update.metaAppSecret       = body.metaAppSecret.trim();
  if (typeof body.metaPageAccessToken  === "string")  update.metaPageAccessToken = body.metaPageAccessToken.trim();
  if (typeof body.metaPageId           === "string")  update.metaPageId          = body.metaPageId.trim();
  if (typeof body.metaVerifyToken      === "string")  update.metaVerifyToken     = body.metaVerifyToken.trim();

  // TikTok
  if (typeof body.tiktokEnabled        === "boolean") update.tiktokEnabled       = body.tiktokEnabled;
  if (typeof body.tiktokAccessToken    === "string")  update.tiktokAccessToken   = body.tiktokAccessToken.trim();
  if (typeof body.tiktokWebhookSecret  === "string")  update.tiktokWebhookSecret = body.tiktokWebhookSecret.trim();

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "nothing_to_update" }, { status: 400 });
  }

  await connectDB();
  await TenantProfileModel.updateOne({ tenantId: token.sub }, { $set: update });
  return NextResponse.json({ ok: true });
}

// ── DELETE ───────────────────────────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  const token = await getServerToken(req);
  if (!token?.sub || token.role !== "tenant") return unauth();

  let body: { platform?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid_body" }, { status: 400 }); }

  const clear: Record<string, unknown> = {};

  if (body.platform === "line") {
    Object.assign(clear, {
      lineOmniEnabled: false, lineChannelSecret: "", lineChannelToken: "", lineLiffId: "",
    });
  } else if (body.platform === "facebook" || body.platform === "meta") {
    Object.assign(clear, {
      metaEnabled: false, metaAppSecret: "", metaPageAccessToken: "", metaPageId: "", metaVerifyToken: "",
    });
  } else if (body.platform === "tiktok") {
    Object.assign(clear, {
      tiktokEnabled: false, tiktokAccessToken: "", tiktokWebhookSecret: "",
    });
  } else {
    return NextResponse.json({ error: "unknown_platform" }, { status: 400 });
  }

  await connectDB();
  await TenantProfileModel.updateOne({ tenantId: token.sub }, { $set: clear });
  return NextResponse.json({ ok: true });
}
