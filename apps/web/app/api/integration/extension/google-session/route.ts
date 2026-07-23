import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { TenantProfileModel } from "@/lib/db/models/TenantProfile";
import { resolveGlobalEmbedKey } from "@/lib/platform/resolveGlobalEmbedKey";
import { buildEmbedScript } from "@/lib/widget/embed-platforms/buildEmbedScript";
import { requirePublicAppUrl } from "@/lib/env/publicAppUrl";
import {
  issueExtensionSession,
  verifyGoogleAccessToken,
} from "@/lib/integration/googleExtensionAuth";

export const dynamic = "force-dynamic";

/**
 * PATH 2 — Exchange Google chrome.identity.getAuthToken for Zudobot session + widget config.
 * Extension never manipulates SRI; server returns ready-to-inject script.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as {
    googleAccessToken?: string;
  } | null;

  const googleAccessToken = body?.googleAccessToken?.trim();
  if (!googleAccessToken) {
    return NextResponse.json({ error: "missing_google_access_token" }, { status: 400 });
  }

  const verified = await verifyGoogleAccessToken(googleAccessToken);
  if (!verified.ok) {
    return NextResponse.json({ error: verified.error }, { status: 401 });
  }

  const appUrl = requirePublicAppUrl();
  const { accessToken, expiresIn } = issueExtensionSession(verified.ctx);

  try {
    if (verified.ctx.role === "tenant") {
      await connectDB();
      const profile = await TenantProfileModel.findOne({
        tenantId: verified.ctx.sub,
      }).lean();
      if (!profile?.embedKey) {
        return NextResponse.json({ error: "no_embed_key" }, { status: 404 });
      }

      const embedScript = buildEmbedScript({
        tenantId: verified.ctx.sub,
        embedKey: profile.embedKey,
        allowedDomain: profile.allowedDomain || "pending",
        appUrl,
        scriptPath: "/widget.js",
      });

      return NextResponse.json({
        ok: true,
        email: verified.email,
        accessToken,
        expiresIn,
        tenantId: verified.ctx.sub,
        embedKey: profile.embedKey,
        embedScript,
        scriptPath: "/widget.js",
      });
    }

    if (verified.ctx.role === "admin" || verified.ctx.role === "super_admin") {
      const embedKey = await resolveGlobalEmbedKey();
      const tenantId =
        process.env.PLATFORM_GLOBAL_CHAT_TENANT_ID?.trim() || "platform-global";
      const embedScript = buildEmbedScript({
        tenantId,
        embedKey,
        allowedDomain: "pending",
        appUrl,
        scriptPath: "/api/public/zudobot/widget.js",
      });

      return NextResponse.json({
        ok: true,
        email: verified.email,
        accessToken,
        expiresIn,
        tenantId,
        embedKey,
        embedScript,
        scriptPath: "/api/public/zudobot/widget.js",
      });
    }

    return NextResponse.json({ error: "forbidden_role" }, { status: 403 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "build_failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
