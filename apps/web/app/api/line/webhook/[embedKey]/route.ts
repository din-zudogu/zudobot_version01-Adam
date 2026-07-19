/**
 * LINE Messaging API Webhook — per-tenant endpoint
 * POST /api/line/webhook/:embedKey
 *
 * Verifies x-line-signature using HMAC-SHA256 + lineChannelSecret.
 * On message event: if text matches lineConnectCode, captures source.userId.
 * Replies with confirmation message and clears the connect code.
 */

import crypto from "crypto";
import https  from "https";
import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { TenantProfileModel } from "@/lib/db/models/TenantProfile";

// ── CORS: LINE sends POST from their servers, no browser origin needed ─────

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}

// ── LINE reply helper ──────────────────────────────────────────────────────

function replyToLine(replyToken: string, channelToken: string, text: string): void {
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

function verifySignature(rawBody: string, channelSecret: string, signature: string): boolean {
  try {
    const expected = crypto
      .createHmac("sha256", channelSecret)
      .update(rawBody)
      .digest("base64");
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

// ── Route handler ──────────────────────────────────────────────────────────

interface LineEvent {
  type:        string;
  replyToken?: string;
  source?:     { userId?: string };
  message?:    { type: string; text: string };
}

export async function POST(
  req: NextRequest,
  { params }: { params: { embedKey: string } }
) {
  const { embedKey } = params;
  const rawBody   = await req.text();
  const signature = req.headers.get("x-line-signature") ?? "";

  await connectDB();
  const profile = await TenantProfileModel.findOne({ embedKey }).lean();

  if (!profile) {
    return new Response(null, { status: 404 });
  }

  if (!profile.lineChannelSecret || !verifySignature(rawBody, profile.lineChannelSecret, signature)) {
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

    if (!sourceId || !profile.lineConnectCode) continue;

    if (text === profile.lineConnectCode.toUpperCase()) {
      await TenantProfileModel.updateOne(
        { embedKey },
        { $set: { lineUserId: sourceId, lineConnectCode: "", lineEnabled: true } }
      );

      if (replyToken && profile.lineChannelToken) {
        replyToLine(
          replyToken,
          profile.lineChannelToken,
          "✅ เชื่อมต่อ Zudobot สำเร็จแล้ว!\nคุณจะได้รับการแจ้งเตือนทุกครั้งที่ลูกค้าขอคุยกับเจ้าหน้าที่"
        );
      }
    }
  }

  return new Response(null, { status: 200 });
}
