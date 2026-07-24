import { NextRequest, NextResponse } from "next/server";
import { requirePublicAppUrl } from "@/lib/env/publicAppUrl";
import { getGitOAuthProviderConfig, isOAuthGitProvider } from "@/lib/integration/gitOAuthProviders";
import { verifyGitOAuthState } from "@/lib/integration/gitOAuthState";
import { encryptGitToken } from "@/lib/integration/gitTokenCrypto";
import { upsertConnection } from "@/lib/db/gitInstall";

export const dynamic = "force-dynamic";

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

function widgetPageUrl(status: "connected" | "error", provider: string, message?: string): string {
  const url = new URL(`${requirePublicAppUrl()}/dashboard/widget`);
  url.searchParams.set("tab", "git");
  url.searchParams.set(status === "connected" ? "connected" : "git_error", status === "connected" ? "1" : message ?? "1");
  url.searchParams.set("provider", provider);
  return url.toString();
}

export async function GET(req: NextRequest, { params }: { params: { provider: string } }) {
  if (!isOAuthGitProvider(params.provider)) {
    return NextResponse.json({ error: "unsupported_provider" }, { status: 400 });
  }

  const searchParams = req.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  if (oauthError) {
    return NextResponse.redirect(widgetPageUrl("error", params.provider, "provider_denied"));
  }

  const verified = verifyGitOAuthState(state, params.provider);
  if (!verified || !code) {
    return NextResponse.redirect(widgetPageUrl("error", params.provider, "invalid_state"));
  }

  let config;
  try {
    config = getGitOAuthProviderConfig(params.provider);
  } catch {
    return NextResponse.redirect(widgetPageUrl("error", params.provider, "integration_not_configured"));
  }

  const redirectUri = `${requirePublicAppUrl()}/api/integration/git/oauth/${params.provider}/callback`;

  try {
    const tokenRes = await fetch(config.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    const tokenData = (await tokenRes.json().catch(() => ({}))) as TokenResponse;

    if (!tokenRes.ok || !tokenData.access_token) {
      console.error(`[git-oauth-callback] ${params.provider} token exchange failed:`, tokenData.error, tokenData.error_description);
      return NextResponse.redirect(widgetPageUrl("error", params.provider, "token_exchange_failed"));
    }

    const identityRes = await fetch(config.identityUrl, {
      headers: { Authorization: `Bearer ${tokenData.access_token}`, Accept: "application/json" },
    });
    const identityBody = await identityRes.json().catch(() => ({}));
    const accountLabel = identityRes.ok ? config.parseIdentity(identityBody) : params.provider;

    await upsertConnection({
      tenantId: verified.tenantId,
      provider: params.provider,
      authMethod: "oauth",
      accountLabel,
      accessTokenEnc: encryptGitToken(tokenData.access_token),
      refreshTokenEnc: tokenData.refresh_token ? encryptGitToken(tokenData.refresh_token) : undefined,
      tokenExpiresAt: tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000) : undefined,
    });

    return NextResponse.redirect(widgetPageUrl("connected", params.provider));
  } catch (err) {
    console.error(`[git-oauth-callback] ${params.provider} unexpected error:`, err);
    return NextResponse.redirect(widgetPageUrl("error", params.provider, "unexpected_error"));
  }
}
