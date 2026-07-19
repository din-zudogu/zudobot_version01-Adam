/**
 * /api/tenant/channels/meta-oauth
 *
 * One-click Facebook + Instagram connection via Meta OAuth.
 * Uses Zudobot's shared Meta App (FACEBOOK_APP_ID / FACEBOOK_APP_SECRET).
 *
 * GET ?action=start   → redirect tenant browser to Facebook OAuth dialog
 * GET ?code=&state=   → OAuth callback: exchange code → get Page token → save → redirect to dashboard
 * GET ?action=pages   → list Facebook Pages after OAuth (for multi-page tenants)
 * PATCH               → tenant picks which page to activate (if they have multiple)
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { connectDB } from "@/lib/db/connect";
import { TenantProfileModel } from "@/lib/db/models/TenantProfile";
import { AMPLIFY_CONFIG } from "@/lib/env/amplifyGuardrail";
import crypto from "crypto";

const SCOPES = [
  "pages_messaging",
  "pages_read_engagement",
  "pages_show_list",
  "instagram_basic",
  "instagram_manage_messages",
].join(",");

// ── Tiny HMAC state signer (CSRF protection, no extra dep) ───────────────────

function signState(tenantId: string): string {
  const payload = `${tenantId}:${Date.now()}`;
  const mac = crypto
    .createHmac("sha256", AMPLIFY_CONFIG.authSecret)
    .update(payload)
    .digest("hex")
    .slice(0, 16);
  return Buffer.from(`${payload}:${mac}`).toString("base64url");
}

function verifyState(state: string): string | null {
  try {
    const decoded  = Buffer.from(state, "base64url").toString();
    const parts    = decoded.split(":");
    if (parts.length !== 3) return null;
    const [tenantId, ts, mac] = parts;
    if (Date.now() - parseInt(ts, 10) > 10 * 60 * 1000) return null; // 10 min TTL
    const expected = crypto
      .createHmac("sha256", AMPLIFY_CONFIG.authSecret)
      .update(`${tenantId}:${ts}`)
      .digest("hex")
      .slice(0, 16);
    if (mac !== expected) return null;
    return tenantId;
  } catch {
    return null;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getAppCredentials() {
  const appId     = process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  return { appId, appSecret };
}

function getCallbackUrl(): string {
  return `${AMPLIFY_CONFIG.authUrl}/api/tenant/channels/meta-oauth`;
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");

  // ── start: generate OAuth URL and redirect ──────────────────────────────
  if (action === "start") {
    const token = await getServerToken(req);
    if (!token?.sub || token.role !== "tenant") {
      return NextResponse.redirect(new URL("/login", req.url));
    }

    const { appId } = getAppCredentials();
    if (!appId) {
      return NextResponse.redirect(
        new URL("/dashboard/channels?meta_error=app_not_configured", req.url)
      );
    }

    const state       = signState(token.sub);
    const redirectUri = getCallbackUrl();

    const oauthUrl = new URL("https://www.facebook.com/dialog/oauth");
    oauthUrl.searchParams.set("client_id",     appId);
    oauthUrl.searchParams.set("redirect_uri",  redirectUri);
    oauthUrl.searchParams.set("scope",         SCOPES);
    oauthUrl.searchParams.set("state",         state);
    oauthUrl.searchParams.set("response_type", "code");

    return NextResponse.redirect(oauthUrl.toString());
  }

  // ── OAuth callback from Facebook ────────────────────────────────────────
  const code  = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const dashboard = new URL("/dashboard/channels", req.url);

  if (error || !code || !state) {
    dashboard.searchParams.set("meta_error", error ?? "cancelled");
    return NextResponse.redirect(dashboard.toString());
  }

  // Verify CSRF state
  const tenantId = verifyState(state);
  if (!tenantId) {
    dashboard.searchParams.set("meta_error", "invalid_state");
    return NextResponse.redirect(dashboard.toString());
  }

  const { appId, appSecret } = getAppCredentials();
  if (!appId || !appSecret) {
    dashboard.searchParams.set("meta_error", "app_not_configured");
    return NextResponse.redirect(dashboard.toString());
  }

  const redirectUri = getCallbackUrl();

  try {
    // Exchange code for user access token
    const tokenRes = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token?` +
      new URLSearchParams({ client_id: appId, client_secret: appSecret, redirect_uri: redirectUri, code }).toString()
    );
    const tokenData = await tokenRes.json() as { access_token?: string; error?: { message: string } };
    if (!tokenData.access_token) throw new Error(tokenData.error?.message ?? "no_token");

    // Get list of managed Facebook Pages (each has its own page access token)
    const pagesRes = await fetch(
      `https://graph.facebook.com/v19.0/me/accounts?` +
      new URLSearchParams({ access_token: tokenData.access_token, fields: "id,name,access_token,tasks" }).toString()
    );
    const pagesData = await pagesRes.json() as {
      data?: Array<{ id: string; name: string; access_token: string; tasks?: string[] }>;
    };

    const pages = pagesData.data ?? [];
    if (pages.length === 0) {
      dashboard.searchParams.set("meta_error", "no_pages");
      return NextResponse.redirect(dashboard.toString());
    }

    // Auto-generate a verifyToken (tenant doesn't need to know this)
    const verifyToken = crypto.randomBytes(16).toString("hex");

    if (pages.length === 1) {
      // Single page: connect immediately
      const page = pages[0];
      await connectDB();
      await TenantProfileModel.updateOne({ tenantId }, {
        $set: {
          metaPageAccessToken: page.access_token,
          metaPageId:          page.id,
          metaVerifyToken:     verifyToken,
          metaEnabled:         true,
        },
      });
      dashboard.searchParams.set("meta_success", "connected");
      dashboard.searchParams.set("meta_page",    page.name);
    } else {
      // Multiple pages: store candidate list temporarily, let tenant pick
      // Encode pages in state cookie / query param (short-lived)
      const pagesParam = Buffer.from(JSON.stringify(
        pages.map((p) => ({ id: p.id, name: p.name, token: p.access_token }))
      )).toString("base64url");

      dashboard.searchParams.set("meta_pending", pagesParam);
      dashboard.searchParams.set("meta_verify",  verifyToken);
      dashboard.searchParams.set("meta_state",   signState(tenantId)); // re-sign for PATCH
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    dashboard.searchParams.set("meta_error", `exchange_failed:${msg}`);
  }

  return NextResponse.redirect(dashboard.toString());
}

// ── PATCH — tenant picks a page from multiple ─────────────────────────────────

export async function PATCH(req: NextRequest) {
  const token = await getServerToken(req);
  if (!token?.sub || token.role !== "tenant") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { pageId: string; pageName: string; pageToken: string; verifyToken: string; state: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid_body" }, { status: 400 }); }

  // Verify CSRF state matches this tenant
  const verified = verifyState(body.state);
  if (verified !== token.sub) {
    return NextResponse.json({ error: "invalid_state" }, { status: 403 });
  }

  await connectDB();
  await TenantProfileModel.updateOne({ tenantId: token.sub }, {
    $set: {
      metaPageAccessToken: body.pageToken,
      metaPageId:          body.pageId,
      metaVerifyToken:     body.verifyToken,
      metaEnabled:         true,
    },
  });
  return NextResponse.json({ ok: true });
}
