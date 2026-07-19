import crypto from "crypto";
import https from "https";
import type { IChannelAdapter, NormalizedMessage, SendReplyOpts } from "../IChannelAdapter";

export class LineAdapter implements IChannelAdapter {
  readonly platform = "line" as const;

  verifySignature(rawBody: string, headers: Record<string, string>, channelSecret: string): boolean {
    const sig = headers["x-line-signature"];
    if (!sig) return false;
    const expected = crypto.createHmac("sha256", channelSecret).update(rawBody).digest("base64");
    try {
      return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
    } catch {
      return false;
    }
  }

  parseInbound(body: unknown, tenantId: string, embedKey: string): NormalizedMessage | null {
    try {
      const payload = body as {
        events?: Array<{
          type:     string;
          source?:  { userId?: string };
          message?: { type: string; text?: string };
        }>;
      };

      const event = payload.events?.find(
        e => e.type === "message" && e.message?.type === "text" && e.source?.userId
      );
      if (!event) return null;

      return {
        platformUserId: event.source!.userId!,
        platformName:   "line",
        tenantId,
        embedKey,
        text:           (event.message!.text ?? "").trim().slice(0, 500),
      };
    } catch {
      return null;
    }
  }

  createDeepLink(token: string, brandUrl: string, extra?: Record<string, string>): string {
    const liffId = extra?.liffId;
    const base   = liffId
      ? `https://liff.line.me/${liffId}`
      : brandUrl.replace(/\/$/, "");
    return `${base}?zudobot=1&ctx=${encodeURIComponent(token)}`;
  }

  async sendReply({ platformUserId, channelToken, botName, deepLink, initialMessage }: SendReplyOpts): Promise<void> {
    const preview = initialMessage.length > 60 ? initialMessage.slice(0, 60) + "…" : initialMessage;
    const messages = [
      {
        type: "text",
        text: `สวัสดีครับ! ${botName} ได้รับข้อความของคุณแล้ว 😊\nกดปุ่มด้านล่างเพื่อดูคำตอบได้เลยครับ`,
      },
      {
        type: "template",
        altText: `คุยกับ ${botName} → กดที่นี่`,
        template: {
          type: "buttons",
          text: `"${preview}"`,
          actions: [
            { type: "uri", label: `คุยกับ ${botName} →`, uri: deepLink },
          ],
        },
      },
    ];

    await this._push(channelToken, platformUserId, messages);
  }

  private _push(channelToken: string, userId: string, messages: unknown[]): Promise<void> {
    return new Promise((resolve) => {
      const body = JSON.stringify({ to: userId, messages });
      const req  = https.request(
        {
          hostname: "api.line.me",
          path:     "/v2/bot/message/push",
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
            if (res.statusCode && res.statusCode >= 300) {
              console.error(`[LineAdapter._push] LINE API error ${res.statusCode}: ${raw}`);
            }
            resolve();
          });
        }
      );
      req.on("error", (err) => {
        console.error("[LineAdapter._push] network error:", err.message);
        resolve();
      });
      req.write(body);
      req.end();
    });
  }
}
