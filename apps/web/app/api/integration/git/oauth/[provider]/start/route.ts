import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { requirePublicAppUrl } from "@/lib/env/publicAppUrl";
import { getGitOAuthProviderConfig, isOAuthGitProvider } from "@/lib/integration/gitOAuthProviders";
import { mintGitOAuthState } from "@/lib/integration/gitOAuthState";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { provider: string } }) {
  if (!isOAuthGitProvider(params.provider)) {
    return NextResponse.json({ error: "unsupported_provider" }, { status: 400 });
  }

  const token = await getServerToken(req);
  if (!token?.sub) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let config;
  try {
    config = getGitOAuthProviderConfig(params.provider);
  } catch {
    return NextResponse.json({ error: "integration_not_configured" }, { status: 503 });
  }

  const state = mintGitOAuthState(token.sub as string, params.provider);
  const redirectUri = `${requirePublicAppUrl()}/api/integration/git/oauth/${params.provider}/callback`;

  const authorizeUrl = new URL(config.authorizeUrl);
  authorizeUrl.searchParams.set("client_id", config.clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("scope", config.scope);
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("response_type", "code");

  return NextResponse.redirect(authorizeUrl.toString());
}
