/**
 * /api/v1/admin/line-notify
 * Manage per-tenant LINE Messaging API settings.
 * Auth: x-secret-key
 *
 * GET   — returns connection status and masked token preview
 * PATCH — { lineChannelSecret?, lineChannelToken?, lineEnabled? }
 *         generates lineConnectCode when both secret + token are provided
 * POST  — send test push notification
 * DELETE — disconnect LINE (clear all LINE fields)
 */

import { NextRequest } from "next/server";
import crypto from "crypto";
import { authenticateRequest, corsHeaders } from "@/lib/middleware/apiKeyAuth";
import dbConnect from "@/lib/db/connect";
import TenantModel from "@/models/tenant";
import BotConfigModel from "@/models/botConfig";
import { sendTestAlert } from "@/services/svc_lineNotify";

function err(msg: string, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify({ success: false, error: msg }), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}

function generateConnectCode(): string {
  const num = crypto.randomInt(1000, 9999);
  return `CONNECT-${num}`;
}

export async function OPTIONS(req: NextRequest) {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}

/* ── GET ──────────────────────────────────────────────────────────────────── */
export async function GET(req: NextRequest) {
  const cors = corsHeaders(req);
  const auth = await authenticateRequest(req);
  if (!auth.ok) return err(auth.error, auth.status, cors);

  await dbConnect();
  const tenant = await TenantModel.findById(auth.tenant._id).lean();

  return new Response(
    JSON.stringify({
      success: true,
      data: {
        tenantId:         String(tenant?._id ?? ""),
        lineEnabled:      tenant?.lineEnabled      ?? false,
        hasChannelToken:  Boolean(tenant?.lineChannelToken),
        hasChannelSecret: Boolean(tenant?.lineChannelSecret),
        hasUserId:        Boolean(tenant?.lineUserId),
        lineConnectCode:  tenant?.lineConnectCode  ?? "",
        tokenPreview: tenant?.lineChannelToken
          ? `••••••••${tenant.lineChannelToken.slice(-4)}`
          : null,
        userIdPreview: tenant?.lineUserId
          ? `${tenant.lineUserId.slice(0, 4)}••••`
          : null,
      },
    }),
    { headers: { "Content-Type": "application/json", ...cors } }
  );
}

/* ── PATCH ────────────────────────────────────────────────────────────────── */
export async function PATCH(req: NextRequest) {
  const cors = corsHeaders(req);
  const auth = await authenticateRequest(req);
  if (!auth.ok) return err(auth.error, auth.status, cors);

  let body: unknown;
  try { body = await req.json(); } catch { return err("Invalid JSON", 400, cors); }

  const b = body as Record<string, unknown>;
  await dbConnect();

  const update: Record<string, unknown> = {};
  if (typeof b.lineChannelSecret === "string") update.lineChannelSecret = b.lineChannelSecret.trim();
  if (typeof b.lineChannelToken  === "string") update.lineChannelToken  = b.lineChannelToken.trim();
  if (typeof b.lineEnabled       === "boolean") update.lineEnabled      = b.lineEnabled;

  if (Object.keys(update).length === 0) return err("Nothing to update", 400, cors);

  // Re-generate connect code when credentials change
  if (update.lineChannelSecret || update.lineChannelToken) {
    const existing = await TenantModel.findById(auth.tenant._id).lean();
    const hasSecret = update.lineChannelSecret || existing?.lineChannelSecret;
    const hasToken  = update.lineChannelToken  || existing?.lineChannelToken;
    if (hasSecret && hasToken) {
      update.lineConnectCode = generateConnectCode();
      update.lineUserId      = "";   // reset captured userId when credentials change
      update.lineEnabled     = false;
    }
  }

  await TenantModel.updateOne({ _id: auth.tenant._id }, { $set: update });

  const updated = await TenantModel.findById(auth.tenant._id).lean();
  return new Response(
    JSON.stringify({
      success: true,
      data: { lineConnectCode: updated?.lineConnectCode ?? "" },
    }),
    { headers: { "Content-Type": "application/json", ...cors } }
  );
}

/* ── POST — send test push notification ───────────────────────────────────── */
export async function POST(req: NextRequest) {
  const cors = corsHeaders(req);
  const auth = await authenticateRequest(req);
  if (!auth.ok) return err(auth.error, auth.status, cors);

  await dbConnect();
  const tenant    = await TenantModel.findById(auth.tenant._id).lean();
  const botConfig = await BotConfigModel.findOne({ tenantId: auth.tenant._id }).lean();

  const channelToken = tenant?.lineChannelToken ?? "";
  const userId       = tenant?.lineUserId       ?? "";
  const shopName     = botConfig?.botName || tenant?.name || "Zudobot Shop";

  if (!channelToken) return err("No Channel Access Token configured.", 400, cors);
  if (!userId)       return err("LINE account not connected yet. Complete Step 3 first.", 400, cors);

  const result = await sendTestAlert(channelToken, userId, shopName);
  if (!result.ok) {
    return new Response(
      JSON.stringify({ success: false, error: result.error }),
      { status: 502, headers: { "Content-Type": "application/json", ...cors } }
    );
  }

  return new Response(
    JSON.stringify({ success: true, message: "Test notification sent ✓" }),
    { headers: { "Content-Type": "application/json", ...cors } }
  );
}

/* ── DELETE — disconnect LINE ─────────────────────────────────────────────── */
export async function DELETE(req: NextRequest) {
  const cors = corsHeaders(req);
  const auth = await authenticateRequest(req);
  if (!auth.ok) return err(auth.error, auth.status, cors);

  await dbConnect();
  await TenantModel.updateOne(
    { _id: auth.tenant._id },
    { $set: {
      lineEnabled:       false,
      lineChannelSecret: "",
      lineChannelToken:  "",
      lineUserId:        "",
      lineConnectCode:   "",
    }}
  );

  return new Response(
    JSON.stringify({ success: true, message: "LINE disconnected." }),
    { headers: { "Content-Type": "application/json", ...cors } }
  );
}
