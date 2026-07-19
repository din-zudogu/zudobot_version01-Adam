import { connectDB } from "@/lib/db/connect";
import { TenantProfileModel } from "@/lib/db/models/TenantProfile";

/** Embed key for zudobot.zudogu.com site widget + platform knowledge (Zudo Guide tenant). */
export function getPlatformEmbedKey(): string | undefined {
  return (
    process.env.ZUDO_GUIDE_EMBED_KEY ??
    process.env.NEXT_PUBLIC_ZUDOBOT_WIDGET_EMBED_KEY
  );
}

export async function getPlatformTenantId(): Promise<string | null> {
  const embedKey = getPlatformEmbedKey();
  if (!embedKey) return null;

  await connectDB();
  const profile = await TenantProfileModel.findOne({ embedKey })
    .select("tenantId allowedDomains widgetEnabled")
    .lean();

  return profile?.tenantId ?? null;
}

export async function ensurePlatformDomainAllowed(domain: string): Promise<void> {
  const embedKey = getPlatformEmbedKey();
  if (!embedKey) return;

  await connectDB();
  const profile = await TenantProfileModel.findOne({ embedKey });
  if (!profile) return;

  const clean = domain.toLowerCase().replace(/^www\./, "");
  const domains = profile.allowedDomains.map((d) => d.toLowerCase().replace(/^www\./, ""));
  if (!domains.includes(clean)) {
    profile.allowedDomains.push(clean);
    await profile.save();
  }
}
