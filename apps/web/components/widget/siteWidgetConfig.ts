/**
 * Public widget on zudobot.zudogu.com (marketing site).
 * Override on Amplify via NEXT_PUBLIC_ZUDOBOT_SITE_EMBED_KEY / NEXT_PUBLIC_ZUDOBOT_SITE_WIDGET_POSITION.
 */
export const SITE_WIDGET_DEFAULT_EMBED_KEY = "4cd9beb1aca36902c7fa9ca0c7d04686";
export const SITE_WIDGET_DEFAULT_API_URL = "https://zudobot.zudogu.com";
export const SITE_WIDGET_DEFAULT_COLOR = "#1E5BC6";
export const SITE_WIDGET_DEFAULT_POSITION = "bottom-left" as const;

export type SiteWidgetPosition = "bottom-right" | "bottom-left";

export function resolveSiteWidgetConfig(): {
  embedKey: string;
  apiUrl: string;
  color: string;
  position: SiteWidgetPosition;
} {
  const positionRaw = process.env.NEXT_PUBLIC_ZUDOBOT_SITE_WIDGET_POSITION?.trim();
  const position: SiteWidgetPosition =
    positionRaw === "bottom-right" || positionRaw === "bottom-left"
      ? positionRaw
      : SITE_WIDGET_DEFAULT_POSITION;

  return {
    embedKey:
      process.env.NEXT_PUBLIC_ZUDOBOT_SITE_EMBED_KEY?.trim() ||
      process.env.NEXT_PUBLIC_ZUDOBOT_WIDGET_EMBED_KEY?.trim() ||
      SITE_WIDGET_DEFAULT_EMBED_KEY,
    apiUrl:
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
      process.env.NEXT_PUBLIC_URL?.replace(/\/$/, "") ||
      SITE_WIDGET_DEFAULT_API_URL,
    color: process.env.NEXT_PUBLIC_ZUDOBOT_SITE_WIDGET_COLOR?.trim() || SITE_WIDGET_DEFAULT_COLOR,
    position,
  };
}
