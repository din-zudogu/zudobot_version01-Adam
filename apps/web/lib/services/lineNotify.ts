/**
 * lineNotify — LINE Messaging API push notification service (web/dashboard side)
 *
 * Uses Node.js https module directly to bypass Next.js fetch patching/caching.
 * Sends push messages via api.line.me/v2/bot/message/push (Channel Access Token).
 */

import https from "https";

const LINE_HOSTNAME  = "api.line.me";
const LINE_PUSH_PATH = "/v2/bot/message/push";
const DASHBOARD_URL  = process.env.NEXT_PUBLIC_APP_URL || "https://zudobot.zudogu.com";

export interface HandoffAlertPayload {
  shopName:       string;
  sessionId:      string;
  visitorId?:     string | null;
  lastMessage:    string;
  deepLinkToken?: string;
}

export interface LinePushResult {
  ok:         boolean;
  status:     number;
  lineError?: string;
}

function buildHandoffMessage(p: HandoffAlertPayload): string {
  const visitor  = p.visitorId || "anonymous";
  const preview  = String(p.lastMessage).slice(0, 200);
  const deepLink = p.deepLinkToken
    ? `${DASHBOARD_URL}/dashboard/live-chat/${p.sessionId}?token=${p.deepLinkToken}`
    : `${DASHBOARD_URL}/dashboard/live-chat/${p.sessionId}`;
  return [
    "🔔 Zudobot — ลูกค้าขอคุยกับเจ้าหน้าที่",
    `ร้าน: ${p.shopName}`,
    `Visitor: ${visitor}`,
    `ข้อความ: ${preview}`,
    "",
    "👉 คลิกเพื่อตอบลูกค้า (ลิงก์หมดอายุใน 10 นาที):",
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
): Promise<LinePushResult> {
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
            resolve({ ok: true, status });
          } else {
            let lineError: string | undefined;
            try { lineError = (JSON.parse(raw) as { message?: string }).message; } catch { /* ignore */ }
            resolve({ ok: false, status, lineError });
          }
        });
      }
    );

    req.on("error", (err: NodeJS.ErrnoException) => {
      resolve({
        ok:        false,
        status:    0,
        lineError: `${err.message} [${err.code ?? "ERR_UNKNOWN"}]`,
      });
    });

    req.write(body);
    req.end();
  });
}

export async function testLinePush(
  channelToken: string,
  userId:       string,
  shopName:     string
): Promise<LinePushResult> {
  return pushToLine(channelToken, userId, buildTestMessage(shopName));
}

export function sendHandoffAlert(
  channelToken: string,
  userId:       string,
  payload:      HandoffAlertPayload
): void {
  void pushToLine(channelToken, userId, buildHandoffMessage(payload));
}
