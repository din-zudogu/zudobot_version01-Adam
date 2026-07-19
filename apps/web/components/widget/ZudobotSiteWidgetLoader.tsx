import { ZudobotSiteWidget } from "./ZudobotSiteWidget";
import { resolveSiteWidgetConfig } from "./siteWidgetConfig";

function widgetScriptUrl(): string {
  const cdn = process.env.NEXT_PUBLIC_WIDGET_CDN_URL?.replace(/\/$/, "");
  const version = process.env.NEXT_PUBLIC_WIDGET_VERSION ?? "v1";
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "https://zudobot.zudogu.com";

  if (cdn) {
    return `${cdn}/${version}/widget.js`;
  }
  return `${appUrl}/widget.js`;
}

/**
 * Loads tenant widget on zudobot.zudogu.com (same as embed snippet in dashboard).
 */
export function ZudobotSiteWidgetLoader() {
  const { embedKey, apiUrl, color, position } = resolveSiteWidgetConfig();

  if (!embedKey) return null;

  return (
    <ZudobotSiteWidget
      embedKey={embedKey}
      widgetSrc={widgetScriptUrl()}
      apiUrl={apiUrl}
      color={color}
      position={position}
    />
  );
}
