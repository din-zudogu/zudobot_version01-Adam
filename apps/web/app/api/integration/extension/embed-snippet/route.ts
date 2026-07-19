import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { TenantProfileModel } from "@/lib/db/models/TenantProfile";
import { resolveGlobalEmbedKey } from "@/lib/platform/resolveGlobalEmbedKey";
import { buildEmbedScript } from "@/lib/widget/embed-platforms/buildEmbedScript";
import { requirePublicAppUrl } from "@/lib/env/publicAppUrl";
import { resolveIntegrationAuth } from "@/lib/integration/extensionAuth";

export const dynamic = "force-dynamic";

/**
 * PATH 2 — Server builds embed HTML (extension never manipulates SRI).
 */
export async function GET(req: NextRequest) {
  const auth = await resolveIntegrationAuth(req);
  if (!auth) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const appUrl = requirePublicAppUrl();

  try {
    if (auth.role === "tenant") {
      await connectDB();
      const profile = await TenantProfileModel.findOne({ tenantId: auth.sub }).lean();
      if (!profile?.embedKey) {
        return NextResponse.json({ error: "no_embed_key" }, { status: 404 });
      }
      const embedScript = buildEmbedScript({
        tenantId: auth.sub,
        embedKey: profile.embedKey,
        allowedDomain: profile.allowedDomain || "pending",
        appUrl,
        scriptPath: "/widget.js",
      });
      return NextResponse.json({
        embedScript,
        scriptPath: "/widget.js",
        tenantId: auth.sub,
        embedKey: profile.embedKey,
      });
    }

    if (auth.role === "admin") {
      const embedKey = await resolveGlobalEmbedKey();
      const tenantId = process.env.PLATFORM_GLOBAL_CHAT_TENANT_ID?.trim() || "platform-global";
      const embedScript = buildEmbedScript({
        tenantId,
        embedKey,
        allowedDomain: "pending",
        appUrl,
        scriptPath: "/api/public/zudobot/widget.js",
      });
      return NextResponse.json({
        embedScript,
        scriptPath: "/api/public/zudobot/widget.js",
        tenantId,
        embedKey,
      });
    }

    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "build_failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
