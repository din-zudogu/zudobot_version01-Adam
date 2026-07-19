import { SITE_WIDGET_DEFAULT_EMBED_KEY } from "@/components/widget/siteWidgetConfig";
import { resolveGlobalEmbedKey } from "@/lib/platform/resolveGlobalEmbedKey";

export function getPlatformSiteHostname(): string {
  const raw =
    process.env.NEXT_PUBLIC_PLATFORM_DOMAIN?.trim() ||
    "zudobot.zudogu.com";
  return raw.toLowerCase().replace(/^www\./, "");
}

/**
 * All embed keys that should be recognized as "this is the platform's own site widget".
 * Includes resolveGlobalEmbedKey() (env → PlatformGlobalBotConfig → bootstrap constant) —
 * the SAME resolution PlatformGlobalSiteWidgetLoader uses to render the live script tag —
 * so the bypass here never drifts out of sync with what the widget actually sends.
 */
async function collectSiteEmbedKeys(): Promise<string[]> {
  const keys = [
    process.env.NEXT_PUBLIC_ZUDOBOT_SITE_EMBED_KEY?.trim(),
    process.env.NEXT_PUBLIC_ZUDOBOT_WIDGET_EMBED_KEY?.trim(),
    process.env.ZUDO_GUIDE_EMBED_KEY?.trim(),
    SITE_WIDGET_DEFAULT_EMBED_KEY,
    await resolveGlobalEmbedKey(),
  ];
  return Array.from(new Set(keys.filter((key): key is string => Boolean(key))));
}

export async function isPlatformSiteWidgetEmbedKey(embedKey: string): Promise<boolean> {
  const normalized = embedKey.trim();
  const keys = await collectSiteEmbedKeys();
  return keys.some((key) => key === normalized);
}

export function isPlatformSiteHostname(hostname: string): boolean {
  const platform = getPlatformSiteHostname();
  const normalized = hostname.toLowerCase().replace(/^www\./, "");
  return normalized === platform || normalized.endsWith(`.${platform}`);
}

/**
 * Official marketing / admin host widget (zudobot.zudogu.com) — bypass tenant domain list.
 */
export async function isPlatformSiteWidgetAccess(embedKey: string, hostname: string): Promise<boolean> {
  return (await isPlatformSiteWidgetEmbedKey(embedKey)) && isPlatformSiteHostname(hostname);
}

/**
 * Single-slot domain (`allowedDomain`) + legacy `allowedDomains` array.
 * Tenant PATCH only updates `allowedDomain` today — widget APIs must merge both.
 */
export function collectEffectiveAllowedDomains(profile: {
  allowedDomain?: string | null;
  allowedDomains?: string[] | null;
}): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (raw: string | undefined | null) => {
    const t = raw?.trim();
    if (!t) return;
    const key = t.toLowerCase().replace(/^www\./, "");
    if (seen.has(key)) return;
    seen.add(key);
    out.push(t);
  };
  push(profile.allowedDomain);
  for (const d of profile.allowedDomains ?? []) push(d);
  return out;
}

export function isHostnameAllowedForProfile(
  hostname: string,
  allowedDomains: string[]
): boolean {
  const normalizedHost = hostname.toLowerCase().replace(/^www\./, "");
  return allowedDomains.some((entry) => {
    const clean = entry.toLowerCase().replace(/^www\./, "").trim();
    if (!clean) return false;
    return normalizedHost === clean || normalizedHost.endsWith(`.${clean}`);
  });
}
