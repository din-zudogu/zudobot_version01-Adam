/**
 * svc_lineNotify — LINE Messaging API per-tenant push notification service
 *
 * Uses Node.js https module directly to bypass Next.js fetch patching/caching.
 * Sends push messages via api.line.me/v2/bot/message/push (Channel Access Token).
 */

import https from "https";

const LINE_HOSTNAME  = "api.line.me";
const LINE_PUSH_PATH = "/v2/bot/message/push";
const DASHBOARD_URL  = process.env.NEXT_PUBLIC_APP_URL || "https://zudobot.zudogu.com";

export interface HandoffAlertPayload {
  shopName:    string;
  sessionId:   string;
  visitorId:   string | null;
  lastMessage: string;
}

function buildHandoffMessage(p: HandoffAlertPayload, deepLinkToken?: string): string {
  const visitor  = p.visitorId || "anonymous";
  const preview  = String(p.lastMessage).slice(0, 200);
  const deepLink = deepLinkToken
    ? `${DASHBOARD_URL}/dashboard/live-chat/${p.sessionId}?token=${deepLinkToken}`
    : `${DASHBOARD_URL}/dashboard/live-chat/${p.sessionId}`;
  return [
    "🔔 Zudobot — ลูกค้าขอคุยกับเจ้าหน้าที่",
    `ร้าน: ${p.shopName}`,
    `Visitor: ${visitor}`,
    `ข้อความ: ${preview}`,
    "",
    "👉 คลิกเพื่อตอบลูกค้า:",
    deepLink,
  ].join("\n");
}

function buildTestMessage(shopName: string): string {
  return [
    "🔔 Zudobot — ทดสอบการแจ้งเตือน",
    `ร้าน: ${shopName}`,
    "✅ LINE Messaging API ตั้งค่าสำเร็จแล้ว",
    "คุณจะได้รับการแจ้งเตือนนี้ทุกครั้งที่ Bot ส่งต่อลูกค้าให้ทีมงาน",
  ].join("\n");
}

function pushToLine(
  channelToken: string,
  userId: string,
  text: string
): Promise<{ ok: boolean; error?: string }> {
  return new Promise((resolve) => {
    const body = JSON.stringify({
      to:       userId,
      messages: [{ type: "text", text }],
    });

    const req = https.request(
      {
        hostname: LINE_HOSTNAME,
        path:     LINE_PUSH_PATH,
        method:   "POST",
        headers:  {
          Authorization:    `Bearer ${channelToken}`,
          "Content-Type":   "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        let raw = "";
        res.on("data", (chunk: Buffer) => { raw += chunk.toString(); });
        res.on("end", () => {
          const status = res.statusCode ?? 0;
          if (status >= 200 && status < 300) {
            resolve({ ok: true });
          } else {
            resolve({ ok: false, error: `LINE API ${status}: ${raw}` });
          }
        });
      }
    );

    req.on("error", (err: NodeJS.ErrnoException) => {
      resolve({ ok: false, error: `${err.message} [${err.code ?? "ERR_UNKNOWN"}]` });
    });

    req.write(body);
    req.end();
  });
}

export async function sendHandoffAlert(
  channelToken:   string,
  userId:         string,
  payload:        HandoffAlertPayload,
  deepLinkToken?: string
): Promise<{ ok: boolean; error?: string }> {
  if (!channelToken) return { ok: false, error: "No LINE Channel Token configured" };
  if (!userId)       return { ok: false, error: "No LINE User ID configured" };
  return pushToLine(channelToken, userId, buildHandoffMessage(payload, deepLinkToken));
}

export async function sendTestAlert(
  channelToken: string,
  userId:       string,
  shopName:     string
): Promise<{ ok: boolean; error?: string }> {
  if (!channelToken) return { ok: false, error: "No LINE Channel Token configured" };
  if (!userId)       return { ok: false, error: "No LINE User ID configured" };
  return pushToLine(channelToken, userId, buildTestMessage(shopName));
}
