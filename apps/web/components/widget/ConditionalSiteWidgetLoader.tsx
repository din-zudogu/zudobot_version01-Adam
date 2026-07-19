"use client";

import { usePathname } from "next/navigation";
import { ZudobotSiteWidgetLoader } from "@/components/widget/ZudobotSiteWidgetLoader";

/**
 * Site marketing widget — never load on /admin (no chat embed on admin panel).
 */
export function ConditionalSiteWidgetLoader() {
  const pathname = usePathname();

  if (!pathname || pathname.startsWith("/admin")) {
    return null;
  }

  return <ZudobotSiteWidgetLoader />;
}
