export type PlatformName = "line" | "facebook" | "instagram" | "tiktok";

export interface NormalizedMessage {
  platformUserId: string;
  platformName:   PlatformName;
  tenantId:       string;
  embedKey:       string;
  text:           string;
  displayName?:   string;
}

export interface SendReplyOpts {
  platformUserId: string;
  channelToken:   string;
  botName:        string;
  deepLink:       string;
  initialMessage: string;
}

export interface IChannelAdapter {
  readonly platform: PlatformName;

  /** Verify that the webhook payload was signed by the platform */
  verifySignature(rawBody: string, headers: Record<string, string>, secret: string): boolean;

  /** Extract a user text message from the platform payload; return null for non-message events */
  parseInbound(body: unknown, tenantId: string, embedKey: string): NormalizedMessage | null;

  /** Send reply back to the customer on the platform */
  sendReply(opts: SendReplyOpts): Promise<void>;

  /** Build the deep link that opens the brand site with auto-open Zudobot */
  createDeepLink(token: string, brandUrl: string, extra?: Record<string, string>): string;
}
