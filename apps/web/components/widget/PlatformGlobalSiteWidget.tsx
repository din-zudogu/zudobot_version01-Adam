"use client";
import Script from "next/script";
import { usePathname } from "next/navigation";

type Props = {
  embedKey: string;
  apiUrl: string;
  position: "bottom-right" | "bottom-left";
  tenantId?: string;
};

export function PlatformGlobalSiteWidget({ embedKey, apiUrl, position, tenantId }: Props) {
  const pathname = usePathname();
  if (!embedKey || !pathname) return null;

  return (
    <Script
      id="zudobot-global-site-widget"
      src={`${apiUrl}/widget.js`}
      data-embed-key={embedKey}
      data-key={embedKey}
      data-api-url={apiUrl}
      data-position={position}
      data-tenant-id={tenantId ?? ""}
      strategy="afterInteractive"
    />
  );
}