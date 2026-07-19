"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";

const DEFAULT_API_URL = "https://zudobot.zudogu.com";
const DEFAULT_COLOR = "#1E5BC6";

export interface ZudobotSiteWidgetProps {
  embedKey: string;
  widgetSrc: string;
  apiUrl?: string;
  color?: string;
  position?: "bottom-right" | "bottom-left";
}

/**
 * Loads the public Zudobot widget on marketing + admin pages.
 * Skips /embed (iframe host) to avoid double-mounting.
 */
export function ZudobotSiteWidget({
  embedKey,
  widgetSrc,
  apiUrl = DEFAULT_API_URL,
  color = DEFAULT_COLOR,
  position = "bottom-right",
}: ZudobotSiteWidgetProps) {
  const pathname = usePathname();

  if (!embedKey) return null;
  if (pathname?.startsWith("/embed")) return null;
  // Admin panel must never mount tenant/marketing widget (avoids 403 noise on /api/widget/*)
  if (pathname?.startsWith("/admin")) return null;
  // Tenant dashboard uses ZudoGuidePanel — avoid duplicate chat UIs
  if (pathname?.startsWith("/dashboard")) return null;

  return (
    <Script
      id="zudobot-site-widget"
      src={widgetSrc}
      strategy="lazyOnload"
      data-key={embedKey}
      data-api-url={apiUrl.replace(/\/$/, "")}
      data-color={color}
      data-position={position}
      defer
    />
  );
}
