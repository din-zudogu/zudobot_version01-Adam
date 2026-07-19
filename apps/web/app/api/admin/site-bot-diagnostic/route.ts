import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { connectDB } from "@/lib/db/connect";
import { TenantProfileModel } from "@/lib/db/models/TenantProfile";
import { KnowledgeChunkModel } from "@/lib/db/models/KnowledgeChunk";
import { getPlatformEmbedKey, getPlatformTenantId } from "@/lib/platform/platformTenant";
import { resolveSiteWidgetConfig } from "@/components/widget/siteWidgetConfig";

/**
 * GET /api/admin/site-bot-diagnostic — super_admin only, read-only.
 *
 * Maps the production identity graph for the zudobot.zudogu.com sales/support bot:
 *  - which embed key the site widget loads (siteWidgetConfig)
 *  - which tenant /admin/knowledge writes KB to (getPlatformTenantId)
 *  - the separate global external-embed tenant (PLATFORM_GLOBAL_CHAT_TENANT_ID)
 *  - for each: does the tenant profile exist, is the widget enabled, allowed domains,
 *    and how many knowledge chunks it has.
 *
 * `aligned.siteWidgetReadsWhatAdminWrites` is the money check: true ⇒ the widget shown
 * on the site is the same bot whose KB you manage at /admin/knowledge.
 */
type TenantInfo =
  | { found: false; lookupEmbedKey: string | null; lookupTenantId: string | null }
  | {
      found: true;
      tenantId: string;
      botName?: string;
      businessName?: string;
      widgetEnabled?: boolean;
      allowedDomain?: string;
      allowedDomains?: string[];
      kbChunks: number;
    };

async function describeTenant(
  embedKey?: string | null,
  tenantId?: string | null,
): Promise<TenantInfo> {
  let profile = null;
  if (embedKey) {
    profile = await TenantProfileModel.findOne({ embedKey })
      .select("tenantId botName businessName widgetEnabled allowedDomain allowedDomains")
      .lean();
  }
  if (!profile && tenantId) {
    profile = await TenantProfileModel.findOne({ tenantId })
      .select("tenantId botName businessName widgetEnabled allowedDomain allowedDomains")
      .lean();
  }
  if (!profile) {
    return { found: false, lookupEmbedKey: embedKey ?? null, lookupTenantId: tenantId ?? null };
  }
  const p = profile as {
    tenantId: string;
    botName?: string;
    businessName?: string;
    widgetEnabled?: boolean;
    allowedDomain?: string;
    allowedDomains?: string[];
  };
  const kbChunks = await KnowledgeChunkModel.countDocuments({ tenantId: p.tenantId });
  return {
    found: true,
    tenantId: p.tenantId,
    botName: p.botName,
    businessName: p.businessName,
    widgetEnabled: p.widgetEnabled,
    allowedDomain: p.allowedDomain,
    allowedDomains: p.allowedDomains,
    kbChunks,
  };
}

export async function GET(req: NextRequest) {
  const token = await getServerToken(req);
  if (token?.role !== "super_admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  await connectDB();

  const site = resolveSiteWidgetConfig();
  const platformEmbedKey = getPlatformEmbedKey() ?? null;
  const platformTenantId = await getPlatformTenantId();
  const globalChatTenantId = process.env.PLATFORM_GLOBAL_CHAT_TENANT_ID?.trim() || null;

  const [siteTenant, platformTenant, globalTenant] = await Promise.all([
    describeTenant(site.embedKey, null),
    describeTenant(platformEmbedKey, platformTenantId),
    describeTenant(null, globalChatTenantId),
  ]);

  const siteTid = siteTenant.found ? siteTenant.tenantId : null;
  const platformTid = platformTenant.found ? platformTenant.tenantId : null;
  const SITE_DOMAIN = "zudobot.zudogu.com";
  const domainOk =
    siteTenant.found &&
    [siteTenant.allowedDomain ?? "", ...(siteTenant.allowedDomains ?? [])]
      .map((d) => d.toLowerCase().replace(/^www\./, ""))
      .includes(SITE_DOMAIN);

  return NextResponse.json({
    env: {
      NEXT_PUBLIC_ZUDOBOT_SITE_EMBED_KEY: process.env.NEXT_PUBLIC_ZUDOBOT_SITE_EMBED_KEY?.trim() || null,
      NEXT_PUBLIC_ZUDOBOT_WIDGET_EMBED_KEY: process.env.NEXT_PUBLIC_ZUDOBOT_WIDGET_EMBED_KEY?.trim() || null,
      ZUDO_GUIDE_EMBED_KEY_set: Boolean(process.env.ZUDO_GUIDE_EMBED_KEY?.trim()),
      PLATFORM_GLOBAL_CHAT_TENANT_ID: globalChatTenantId,
    },
    siteWidget: { resolvedEmbedKey: site.embedKey, apiUrl: site.apiUrl, position: site.position, tenant: siteTenant },
    platformKbTarget: { embedKey: platformEmbedKey, tenant: platformTenant },
    globalExternalEmbed: { tenantId: globalChatTenantId, tenant: globalTenant },
    aligned: {
      siteWidgetReadsWhatAdminWrites: Boolean(siteTid && platformTid && siteTid === platformTid),
      siteWidgetEnabled: siteTenant.found ? Boolean(siteTenant.widgetEnabled) : false,
      siteDomainWhitelisted: domainOk,
      siteTenantHasKnowledge: siteTenant.found ? siteTenant.kbChunks > 0 : false,
    },
  });
}
