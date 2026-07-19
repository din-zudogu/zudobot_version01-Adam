import crypto from "crypto";
import type { IChannelAdapter, NormalizedMessage, SendReplyOpts } from "../IChannelAdapter";

/**
 * TikTok Open Platform — Direct Message events.
 * Signature: HMAC-SHA256 of sorted([appSecret, timestamp, nonce, rawBody]).join("")
 * https://developers.tiktok.com/doc/webhooks-verification
 */
export class TikTokAdapter implements IChannelAdapter {
  readonly platform = "tiktok" as const;

  verifySignature(rawBody: string, headers: Record<string, string>, appSecret: string): boolean {
    const timestamp = headers["x-tiktok-timestamp"] ?? headers["tt-timestamp"] ?? "";
    const nonce     = headers["x-tiktok-nonce"]     ?? headers["tt-nonce"]     ?? "";
    const received  = headers["x-tiktok-signature"] ?? headers["tt-signature"]  ?? "";
    if (!timestamp || !nonce || !received) return false;

    const parts   = [appSecret, timestamp, nonce, rawBody].sort();
    const toSign  = parts.join("");
    const expected = crypto.createHmac("sha256", appSecret).update(toSign).digest("hex");
    try {
      return crypto.timingSafeEqual(
        Buffer.from(received.toLowerCase()),
        Buffer.from(expected.toLowerCase()),
      );
    } catch {
      return false;
    }
  }

  parseInbound(body: unknown, tenantId: string, embedKey: string): NormalizedMessage | null {
    try {
      const payload = body as {
        event?: string;
        data?:  {
          from?:    { open_id?: string; display_name?: string };
          content?: string;
          text?:    string;
        };
      };

      if (!["chat", "direct_message", "dm"].includes(payload.event ?? "")) return null;
      const userId = payload.data?.from?.open_id;
      const text   = (payload.data?.content ?? payload.data?.text ?? "").trim();
      if (!userId || !text) return null;

      return {
        platformUserId: userId,
        platformName:   "tiktok",
        tenantId,
        embedKey,
        text:           text.slice(0, 500),
        displayName:    payload.data?.from?.display_name,
      };
    } catch {
      return null;
    }
  }

  createDeepLink(token: string, brandUrl: string): string {
    return `${brandUrl.replace(/\/$/, "")}?zudobot=1&ctx=${encodeURIComponent(token)}`;
  }

  async sendReply({ platformUserId, channelToken, botName, deepLink, initialMessage }: SendReplyOpts): Promise<void> {
    const preview = initialMessage.length > 60 ? initialMessage.slice(0, 60) + "…" : initialMessage;
    const body = JSON.stringify({
      receiver_open_id: platformUserId,
      message_type:     "text",
      content: {
        text: `สวัสดีครับ! ${botName} ได้รับข้อความของคุณแล้ว 😊\n"${preview}"\n\nกดลิงก์นี้เพื่อดูคำตอบและสนทนาต่อได้เลยครับ:\n${deepLink}`,
      },
    });

    await fetch("https://open.tiktokapis.com/v2/dm/send/", {
      method:  "POST",
      headers: { Authorization: `Bearer ${channelToken}`, "Content-Type": "application/json" },
      body,
    });
  }
}
