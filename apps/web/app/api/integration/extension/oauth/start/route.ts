import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import {
  createExtensionAccessToken,
  isAllowedExtensionRedirectUri,
} from "@/lib/integration/extensionAuth";
import { requirePublicAppUrl } from "@/lib/env/publicAppUrl";

export const dynamic = "force-dynamic";

/**
 * PATH 2 — Chrome identity.launchWebAuthFlow entry.
 * Logged-in user receives access_token in URL hash; else redirect to login.
 */
export async function GET(req: NextRequest) {
  const redirectUri = req.nextUrl.searchParams.get("redirect_uri")?.trim() ?? "";
  if (!isAllowedExtensionRedirectUri(redirectUri)) {
    return NextResponse.json({ error: "invalid_redirect_uri" }, { status: 400 });
  }

  const session = await getServerToken(req);
  if (!session?.sub || !session.role) {
    const appUrl = requirePublicAppUrl();
    const returnTo = `${appUrl}/api/integration/extension/oauth/start?redirect_uri=${encodeURIComponent(redirectUri)}`;
    const login = new URL("/login", appUrl);
    login.searchParams.set("callbackUrl", returnTo);
    return NextResponse.redirect(login);
  }

  if (session.role !== "tenant" && session.role !== "admin") {
    return NextResponse.json({ error: "forbidden_role" }, { status: 403 });
  }

  const { accessToken, expiresIn } = createExtensionAccessToken({
    sub: session.sub as string,
    role: session.role as string,
  });

  const target = new URL(redirectUri);
  target.hash = new URLSearchParams({
    access_token: accessToken,
    token_type: "bearer",
    expires_in: String(expiresIn),
  }).toString();

  return NextResponse.redirect(target.toString());
}
