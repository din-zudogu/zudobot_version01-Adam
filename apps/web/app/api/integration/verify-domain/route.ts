import { NextRequest, NextResponse } from "next/server";
import { resolveIntegrationAuth } from "@/lib/integration/extensionAuth";
import { connectDB } from "@/lib/db/connect";
import { TenantProfileModel } from "@/lib/db/models/TenantProfile";
import { PlatformGlobalBotConfigModel } from "@/lib/db/models/PlatformGlobalBotConfig";
import { normalizeWhitelistDomain } from "@/lib/platform/normalizeWhitelistDomain";
import { isDomainExplicitlyWhitelisted } from "@/lib/security/secureOrigin";

export const dynamic = "force-dynamic";

/**
 * PATH 2 — Domain ownership check for Chrome Extension.
 * Does not return SRI hash or embed script (transport layer only).
 */
export async function POST(req: NextRequest) {
  const token = await resolveIntegrationAuth(req);
  if (!token?.sub) {
    return NextResponse.json({ verified: false, error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { hostname?: string } | null;
  const hostname = normalizeWhitelistDomain(body?.hostname ?? "");
  if (!hostname) {
    return NextResponse.json({ verified: false, error: "invalid_hostname" }, { status: 400 });
  }

  await connectDB();

  if (token.role === "admin") {
    const configs = await PlatformGlobalBotConfigModel.find().lean();
    const allowed = configs.some((c) =>
      isDomainExplicitlyWhitelisted(hostname, c.whitelistedDomains ?? [])
    );
    return NextResponse.json({ verified: allowed, hostname, scope: "platform_global" });
  }

  if (token.role === "tenant") {
    const profile = await TenantProfileModel.findOne({ tenantId: token.sub }).lean();
    const allowedDomain = profile?.allowedDomain?.trim();
    const normalized = allowedDomain ? normalizeWhitelistDomain(allowedDomain) : null;
    const verified = normalized === hostname;
    return NextResponse.json({ verified, hostname, scope: "tenant_single" });
  }

  return NextResponse.json({ verified: false, error: "forbidden" }, { status: 403 });
}
