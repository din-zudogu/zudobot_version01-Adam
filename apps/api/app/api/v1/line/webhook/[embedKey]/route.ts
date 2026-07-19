/**
 * LINE Messaging API Webhook — per-tenant endpoint
 * POST /api/v1/line/webhook/:embedKey
 *
 * Verifies x-line-signature using HMAC-SHA256 + lineChannelSecret.
 * On message event: if text matches lineConnectCode, captures source.userId.
 * Replies with confirmation message and clears the connect code.
 */

import crypto from "crypto";
import https  from "https";
import { NextRequest } from "next/server";
import dbConnect from "@/lib/db/connect";
import TenantModel from "@/models/tenant";

// ── LINE reply helper ──────────────────────────────────────────────────────

function replyToLine(
  replyToken:   string,
  channelToken: string,
  text:         string
): void {
  const body = JSON.stringify({
    replyToken,
    messages: [{ type: "text", text }],
  });
  const req = https.request({
    hostname: "api.line.me",
    path:     "/v2/bot/message/reply",
    method:   "POST",
    headers:  {
      Authorization:    `Bearer ${channelToken}`,
      "Content-Type":   "application/json",
      "Content-Length": Buffer.byteLength(body),
    },
  });
  req.on("error", () => { /* fire-and-forget */ });
  req.write(body);
  req.end();
}

// ── Signature verification ─────────────────────────────────────────────────

function verifySignature(
  rawBody:       string,
  channelSecret: string,
  signature:     string
): boolean {
  const expected = crypto
    .createHmac("sha256", channelSecret)
    .update(rawBody)
    .digest("base64");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

// ── Route handler ──────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: { embedKey: string } }
) {
  const { embedKey } = params;
  const rawBody   = await req.text();
  const signature = req.headers.get("x-line-signature") ?? "";

  await dbConnect();
  // Find tenant by publicKey (same value as embedKey in the widget script)
  const tenant = await TenantModel.findOne({ publicKey: embedKey }).lean();

  if (!tenant) {
    return new Response(null, { status: 404 });
  }

  // Verify signature with tenant's Channel Secret
  if (!tenant.lineChannelSecret || !verifySignature(rawBody, tenant.lineChannelSecret, signature)) {
    return new Response(null, { status: 401 });
  }

  let payload: { events?: LineEvent[] };
  try { payload = JSON.parse(rawBody) as { events?: LineEvent[] }; }
  catch { return new Response(null, { status: 400 }); }

  const events = payload.events ?? [];

  for (const event of events) {
    if (event.type !== "message" || event.message?.type !== "text") continue;

    const text       = event.message.text.trim().toUpperCase();
    const sourceId   = event.source?.userId;
    const replyToken = event.replyToken;

    if (!sourceId || !tenant.lineConnectCode) continue;

    const expectedCode = tenant.lineConnectCode.toUpperCase();

    if (text === expectedCode) {
      // Capture userId and clear connect code
      await TenantModel.updateOne(
        { publicKey: embedKey },
        { $set: { lineUserId: sourceId, lineConnectCode: "", lineEnabled: true } }
      );

      if (replyToken && tenant.lineChannelToken) {
        replyToLine(
          replyToken,
          tenant.lineChannelToken,
          "✅ เชื่อมต่อ Zudobot สำเร็จแล้ว!\nคุณจะได้รับการแจ้งเตือนทุกครั้งที่ลูกค้าขอคุยกับเจ้าหน้าที่"
        );
      }
    }
  }

  return new Response(null, { status: 200 });
}

// ── LINE event types ───────────────────────────────────────────────────────

interface LineEvent {
  type:        string;
  replyToken?: string;
  source?:     { userId?: string };
  message?:    { type: string; text: string };
}
