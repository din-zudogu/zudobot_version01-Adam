import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import https from "https";
import { mdw_omni_zdb_chat } from "@/lib/channels/mdw_omni_zdb_chat";
import { connectDB } from "@/lib/db/connect";
import { TenantProfileModel } from "@/lib/db/models/TenantProfile";

export const dynamic = "force-dynamic";

// ── Helpers shared with connect-code handler ────────────────────────────────

function verifyLineSignature(rawBody: string, secret: string, sig: string): boolean {
  try {
    const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("base64");
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
  } catch {
    return false;
  }
}

function lineReply(replyToken: string, channelToken: string, text: string): void {
  const body = JSON.stringify({ replyToken, messages: [{ type: "text", text }] });
  const req = https.request({
    hostname: "api.line.me",
    path: "/v2/bot/message/reply",
    method: "POST",
    headers: {
      Authorization: `Bearer ${channelToken}`,
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(body),
    },
  });
  req.on("error", () => {});
  req.write(body);
  req.end();
}

interface LineEvent {
  type: string;
  replyToken?: string;
  source?: { userId?: string };
  message?: { type: string; text?: string };
}

// ── Human handoff connect-code handler ─────────────────────────────────────
// The shop owner sends a connect code to their LINE OA.
// If it matches, we capture their lineUserId so we can push them alerts later.
// Returns true if the event was consumed (caller must return 200 immediately).

async function handleConnectCode(
  tenantId: string,
  rawBody: string,
  sig: string,
): Promise<boolean> {
  await connectDB();
  const profile = await TenantProfileModel.findOne({ tenantId })
    .select("lineChannelSecret lineChannelToken lineConnectCode")
    .lean();

  // Fast-path: no connect code active → skip
  if (!profile?.lineConnectCode || !profile.lineChannelSecret) return false;

  if (!verifyLineSignature(rawBody, profile.lineChannelSecret, sig)) return false;

  let payload: { events?: LineEvent[] };
  try { payload = JSON.parse(rawBody) as { events?: LineEvent[] }; }
  catch { return false; }

  for (const ev of payload.events ?? []) {
    if (ev.type !== "message" || ev.message?.type !== "text") continue;
    const text   = ev.message.text?.trim().toUpperCase() ?? "";
    const userId = ev.source?.userId;
    if (!userId) continue;

    if (text === profile.lineConnectCode.toUpperCase()) {
      await TenantProfileModel.updateOne(
        { tenantId },
        { $set: { lineUserId: userId, lineConnectCode: "", lineEnabled: true } },
      );
      if (ev.replyToken && profile.lineChannelToken) {
        lineReply(
          ev.replyToken,
          profile.lineChannelToken,
          "✅ เชื่อมต่อ Zudobot สำเร็จแล้ว!\nคุณจะได้รับการแจ้งเตือนทุกครั้งที่ลูกค้าขอคุยกับเจ้าหน้าที่",
        );
      }
      return true;
    }
  }
  return false;
}

// ── Route handler ───────────────────────────────────────────────────────────
// Single webhook URL handles both:
//   • Human handoff connect-code setup (shop owner → LINE OA)
//   • OmniChat deep-link flow (customer → LINE OA → deep link reply)

export async function POST(
  req: NextRequest,
  { params }: { params: { tenantId: string } },
) {
  const rawBody = await req.text();
  const sig = req.headers.get("x-line-signature") ?? "";

  // Human handoff takes priority — connect code events are consumed here
  const handled = await handleConnectCode(params.tenantId, rawBody, sig);
  if (handled) return NextResponse.json({ ok: true }, { status: 200 });

  // OmniChat deep-link flow for regular customer messages
  const headers: Record<string, string> = {};
  req.headers.forEach((v, k) => { headers[k] = v; });

  const result = await mdw_omni_zdb_chat("line", params.tenantId, rawBody, headers);
  return NextResponse.json({ ok: result.ok }, { status: result.status });
}
