import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { TenantProfileModel } from "@/lib/db/models/TenantProfile";
import {
  collectEffectiveAllowedDomains,
  getPlatformSiteHostname,
  isHostnameAllowedForProfile,
  isPlatformSiteWidgetAccess,
} from "@/lib/widget/platformSiteWidgetAccess";
import { ensurePlatformSiteTenantProfile } from "@/lib/platform/ensurePlatformSiteTenantProfile";

export const dynamic = "force-dynamic";

// Strips protocol, www., trailing slashes — must match normalizeHostname in /api/tenant/domains
function normalizeHostname(raw: string): string | null {
  try {
    const url = raw.trim().startsWith("http") ? raw.trim() : `https://${raw.trim()}`;
    const { hostname } = new URL(url);
    if (!hostname) return null;
    return hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

function corsHeaders(origin: string) {
  return {
    "Access-Control-Allow-Origin":  origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age":       "86400",
  };
}

function forbidden(error: string, origin: string) {
  // Always include CORS headers on errors so the browser can read the response body
  return NextResponse.json(
    { ok: false, error },
    { status: 403, headers: corsHeaders(origin) }
  );
}

// Preflight — origin check happens on POST; OPTIONS just needs to greenlight the method
export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get("origin") ?? "*";
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}

export async function POST(req: NextRequest) {
  const rawOrigin = req.headers.get("origin") || req.headers.get("referer") || "";
  const body      = await req.json().catch(() => ({})) as { key?: string };
  const embedKey  = body.key;

  if (!embedKey) {
    return NextResponse.json({ ok: false, error: "missing_key" }, { status: 400, headers: corsHeaders(rawOrigin) });
  }

  const requestHostname = normalizeHostname(rawOrigin);
  if (!requestHostname) {
    return forbidden("missing_origin", rawOrigin);
  }

  await connectDB();
  let profile = await TenantProfileModel.findOne({ embedKey });

  const platformSiteAccess = await isPlatformSiteWidgetAccess(embedKey, requestHostname);

  if (!profile) {
    if (!platformSiteAccess) return forbidden("invalid_key", rawOrigin);

    // Self-provision a TenantProfile for the platform's own site widget the first time
    // it's ever seen, so it behaves exactly like any other tenant (same config shape,
    // same consent notice) instead of the client falling back to hardcoded defaults.
    profile = await ensurePlatformSiteTenantProfile();
  }

  if (!profile.widgetEnabled && !platformSiteAccess) {
    return forbidden("widget_disabled", rawOrigin);
  }

  const effectiveDomains = collectEffectiveAllowedDomains(profile);

  const isAllowed =
    isHostnameAllowedForProfile(requestHostname, effectiveDomains) ||
    platformSiteAccess;

  if (!isAllowed) return forbidden("domain_not_allowed", rawOrigin);

  if (platformSiteAccess) {
    const platformHost = getPlatformSiteHostname();
    const domains = effectiveDomains.map((d) => d.toLowerCase().replace(/^www\./, ""));
    if (!domains.includes(platformHost)) {
      profile.allowedDomains.push(platformHost);
      profile.allowedDomain = profile.allowedDomain || platformHost;
      profile.widgetEnabled = true;
      void profile.save().catch(() => {});
    }
  }

  return NextResponse.json(
    {
      ok: true,
      config: {
        botName:        profile.botName,
        welcomeMessage: profile.welcomeMessage,
        widgetColor:    profile.widgetColor,
        widgetPosition: profile.widgetPosition,
        requireConsent: false,
        consentText:    "ระบบแชท จะไม่มีการเก็บข้อมูลส่วนตัวใดๆของผู้สนทนาทั้งสิ้น",
      },
    },
    { headers: corsHeaders(rawOrigin) }
  );
}
