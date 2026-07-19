/** Canonical Zudobot API host for tenant embeds (never the customer storefront origin). */
export const ZUDOBOT_WIDGET_API_ORIGIN = "https://zudobot.zudogu.com";

/**
 * Resolves widget API base URL. Empty or customer-site values must not produce
 * relative fetches against the host page (e.g. zudogu.com → HTML index).
 */
export function resolveWidgetApiOrigin(dataApiUrlAttr: string | null | undefined): string {
  const trimmed = dataApiUrlAttr?.trim();
  if (!trimmed) return ZUDOBOT_WIDGET_API_ORIGIN;

  try {
    const { protocol, hostname, origin } = new URL(trimmed);
    if (protocol !== "http:" && protocol !== "https:") return ZUDOBOT_WIDGET_API_ORIGIN;
    const host = hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1") {
      return origin.replace(/\/$/, "");
    }
  } catch {
    return ZUDOBOT_WIDGET_API_ORIGIN;
  }

  return ZUDOBOT_WIDGET_API_ORIGIN;
}
