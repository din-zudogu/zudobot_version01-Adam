import { resolveGlobalEmbedKey } from "@/lib/platform/resolveGlobalEmbedKey";
import { PlatformGlobalSiteWidget } from "./PlatformGlobalSiteWidget";

function siteApiUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "https://zudobot.zudogu.com"
  );
}

export async function PlatformGlobalSiteWidgetLoader() {
  const embedKey = await resolveGlobalEmbedKey();
  if (!embedKey) return null;

  const positionRaw = process.env.NEXT_PUBLIC_ZUDOBOT_SITE_WIDGET_POSITION?.trim();
  const position = positionRaw === "bottom-right" ? "bottom-right" : "bottom-left";

  const tenantId = process.env.PLATFORM_GLOBAL_TENANT_ID?.trim() || "";

  return (
    <PlatformGlobalSiteWidget
      embedKey={embedKey}
      apiUrl={siteApiUrl()}
      position={position}
      tenantId={tenantId}
    />
  );
}