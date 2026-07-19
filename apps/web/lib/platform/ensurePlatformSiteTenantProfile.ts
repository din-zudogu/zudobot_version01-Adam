import { TenantProfileModel } from "@/lib/db/models/TenantProfile";
import { getPlatformSiteHostname } from "@/lib/widget/platformSiteWidgetAccess";
import { resolveGlobalEmbedKey } from "@/lib/platform/resolveGlobalEmbedKey";

/**
 * The TenantProfile document that actually powers the live zudobot.zudogu.com
 * widget (System B) — same schema, same /api/widget/* routes as any paying
 * tenant. Self-provisions on first use so the platform's own bot always has
 * a real profile instead of the client falling back to hardcoded defaults.
 */
export async function ensurePlatformSiteTenantProfile() {
  const embedKey = await resolveGlobalEmbedKey();
  let profile = await TenantProfileModel.findOne({ embedKey });

  if (!profile) {
    const platformHost = getPlatformSiteHostname();
    profile = await TenantProfileModel.findOneAndUpdate(
      { embedKey },
      {
        $setOnInsert: {
          tenantId:       `platform-global-${embedKey.slice(0, 16)}`,
          businessName:   "ZUDOBOT",
          businessType:   "internal_platform",
          botName:        "Zudobot",
          widgetEnabled:  true,
          allowedDomain:  platformHost,
          allowedDomains: [platformHost],
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  if (!profile) throw new Error("Failed to provision platform site TenantProfile.");
  return profile;
}
