/**
 * mdw_omni_zdb_chat
 *
 * Unified omni-channel gateway: LINE / Facebook Messenger / Instagram / TikTok → Zudobot widget on brand website.
 *
 * Flow per incoming customer message:
 *   1. Verify platform webhook signature
 *   2. Parse inbound → NormalizedMessage (platform-agnostic)
 *   3. Create short-lived context token (15 min TTL, single-use)
 *   4. Build deep link: brand-site?zudobot=1&ctx={token}
 *   5. Send reply to customer via platform API (fire-and-forget, non-blocking)
 *
 * Adding a new platform = implement IChannelAdapter + register in ADAPTERS below.
 */

import { connectDB } from "@/lib/db/connect";
import { TenantProfileModel } from "@/lib/db/models/TenantProfile";
import type { ITenantProfile } from "@/lib/db/models/TenantProfile";
import { createContextToken } from "./ContextTokenService";
import { LineAdapter }   from "./adapters/LineAdapter";
import { MetaAdapter }   from "./adapters/MetaAdapter";
import { TikTokAdapter } from "./adapters/TikTokAdapter";
import type { IChannelAdapter, PlatformName } from "./IChannelAdapter";

// ── Adapter registry — add new platforms here only ──────────────────
const ADAPTERS = new Map<string, IChannelAdapter>([
  ["line",      new LineAdapter()],
  ["facebook",  new MetaAdapter()],
  ["instagram", new MetaAdapter()],  // Meta Graph API handles both FB + IG
  ["tiktok",    new TikTokAdapter()],
]);

// ── Result type ──────────────────────────────────────────────────────
export interface OmniHandleResult {
  ok:     boolean;
  error?: string;
  status: number;
}

// ── Main entry point ─────────────────────────────────────────────────

export async function mdw_omni_zdb_chat(
  platform: string,
  tenantId: string,
  rawBody:  string,
  headers:  Record<string, string>,
): Promise<OmniHandleResult> {

  const adapter = ADAPTERS.get(platform);
  if (!adapter) return { ok: false, error: "unsupported_platform", status: 400 };

  // ── 1. Load tenant ────────────────────────────────────────────────
  await connectDB();
  const profile = await TenantProfileModel.findOne({ tenantId }).lean() as ITenantProfile | null;
  if (!profile) return { ok: false, error: "tenant_not_found", status: 404 };

  const tag = `[mdw_omni][${platform}][${tenantId.slice(-6)}]`;

  // ── 2. Resolve per-platform credentials ──────────────────────────
  const creds = resolveCreds(platform as PlatformName, profile);
  if (!creds.enabled)       { console.warn(`${tag} channel_not_enabled`);    return { ok: false, error: "channel_not_enabled",    status: 403 }; }
  if (!creds.channelSecret) { console.warn(`${tag} channel_secret_missing`); return { ok: false, error: "channel_secret_missing", status: 403 }; }
  if (!creds.channelToken)  { console.warn(`${tag} channel_token_missing`);  return { ok: false, error: "channel_token_missing",  status: 403 }; }

  // ── 3. Verify signature ───────────────────────────────────────────
  let body: unknown;
  try { body = JSON.parse(rawBody); }
  catch { console.warn(`${tag} invalid_json`); return { ok: false, error: "invalid_json", status: 400 }; }

  if (!adapter.verifySignature(rawBody, headers, creds.channelSecret)) {
    console.warn(`${tag} signature_invalid`);
    return { ok: false, error: "signature_invalid", status: 401 };
  }

  // ── 4. Parse inbound message ──────────────────────────────────────
  const msg = adapter.parseInbound(body, tenantId, profile.embedKey);
  if (!msg) { console.log(`${tag} non-message event — ack`); return { ok: true, status: 200 }; }

  // ── 5. Create context token ───────────────────────────────────────
  const token = await createContextToken({
    tenantId:       tenantId,
    embedKey:       profile.embedKey,
    platformUserId: msg.platformUserId,
    platformName:   msg.platformName,
    initialMessage: msg.text,
    displayName:    msg.displayName,
  });

  // ── 6. Build deep link to brand website ──────────────────────────
  // Prefer the verified widget domain; fall back to websiteUrl set at onboarding.
  const brandUrl = profile.allowedDomain
    ? `https://${profile.allowedDomain}`
    : (profile.websiteUrl ?? "").replace(/\/$/, "") || "https://zudobot.zudogu.com";
  const deepLink = adapter.createDeepLink(
    token,
    brandUrl,
    creds.liffId ? { liffId: creds.liffId } : undefined,
  );

  // ── 7. Reply to customer (non-blocking — webhook must ack fast) ───
  console.log(`${tag} sending reply → userId=${msg.platformUserId.slice(-4)} deepLink=${deepLink}`);
  adapter.sendReply({
    platformUserId: msg.platformUserId,
    channelToken:   creds.channelToken,
    botName:        profile.botName || "Zudobot",
    deepLink,
    initialMessage: msg.text,
  }).catch(e => console.error(`${tag} sendReply error:`, e));

  return { ok: true, status: 200 };
}

// ── Credential resolver (maps platform → TenantProfile fields) ───────

interface ChannelCreds {
  enabled:       boolean;
  channelSecret: string | undefined;
  channelToken:  string | undefined;
  liffId?:       string;
}

function resolveCreds(platform: PlatformName, p: ITenantProfile): ChannelCreds {
  switch (platform) {
    case "line":
      return {
        enabled:       p.lineOmniEnabled ?? false,
        channelSecret: p.lineChannelSecret,
        channelToken:  p.lineChannelToken,
        liffId:        p.lineLiffId,
      };
    case "facebook":
    case "instagram":
      return {
        enabled:       p.metaEnabled ?? false,
        // Per-tenant secret takes priority; fall back to Zudobot shared Meta App secret
        channelSecret: p.metaAppSecret || process.env.FACEBOOK_APP_SECRET,
        channelToken:  p.metaPageAccessToken,
      };
    case "tiktok":
      return {
        enabled:       p.tiktokEnabled ?? false,
        channelSecret: p.tiktokWebhookSecret,
        channelToken:  p.tiktokAccessToken,
      };
    default:
      return { enabled: false, channelSecret: undefined, channelToken: undefined };
  }
}
