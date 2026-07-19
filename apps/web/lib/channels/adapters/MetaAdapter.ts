import crypto from "crypto";
import type { IChannelAdapter, NormalizedMessage, PlatformName, SendReplyOpts } from "../IChannelAdapter";

/**
 * Handles both Facebook Messenger and Instagram DM.
 * Both use Meta Graph API — object type "page" vs "instagram" distinguishes them.
 */
export class MetaAdapter implements IChannelAdapter {
  readonly platform = "facebook" as const;

  verifySignature(rawBody: string, headers: Record<string, string>, appSecret: string): boolean {
    const sig = headers["x-hub-signature-256"] ?? "";
    if (!sig.startsWith("sha256=")) return false;
    const expected = "sha256=" + crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");
    try {
      return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
    } catch {
      return false;
    }
  }

  parseInbound(body: unknown, tenantId: string, embedKey: string): NormalizedMessage | null {
    try {
      const payload = body as {
        object?: string;
        entry?:  Array<{
          messaging?: Array<{
            sender?:  { id?: string };
            message?: { text?: string; is_echo?: boolean };
          }>;
        }>;
      };

      const obj = payload.object ?? "";
      if (!["page", "instagram"].includes(obj)) return null;
      const platformName: PlatformName = obj === "instagram" ? "instagram" : "facebook";

      const event = payload.entry?.[0]?.messaging?.[0];
      if (!event?.sender?.id || !event?.message?.text) return null;
      if (event.message.is_echo) return null; // ignore echoes of own messages

      return {
        platformUserId: event.sender.id,
        platformName,
        tenantId,
        embedKey,
        text: event.message.text.trim().slice(0, 500),
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
      recipient: { id: platformUserId },
      message: {
        attachment: {
          type: "template",
          payload: {
            template_type: "button",
            text: `${botName} พร้อมตอบแล้วครับ! 😊\n"${preview}"`,
            buttons: [
              {
                type:                  "web_url",
                url:                   deepLink,
                title:                 `คุยกับ ${botName} →`,
                webview_height_ratio:  "full",
              },
            ],
          },
        },
      },
    });

    await fetch(
      `https://graph.facebook.com/v19.0/me/messages?access_token=${channelToken}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body }
    );
  }
}
