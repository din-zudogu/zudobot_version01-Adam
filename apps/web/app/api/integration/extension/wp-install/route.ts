import { NextRequest, NextResponse } from "next/server";
import { resolveIntegrationAuth } from "@/lib/integration/extensionAuth";
import { normalizeWhitelistDomain } from "@/lib/platform/normalizeWhitelistDomain";
import { requirePublicAppUrl } from "@/lib/env/publicAppUrl";

export const dynamic = "force-dynamic";

/**
 * PATH 2 — Proxy install to WordPress plugin REST (Zudobot Embed plugin required).
 * Extension supplies Application Password; server never stores it.
 */
export async function POST(req: NextRequest) {
  const auth = await resolveIntegrationAuth(req);
  if (!auth) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as {
    siteUrl?: string;
    wpUser?: string;
    wpAppPassword?: string;
    hostname?: string;
  } | null;

  const siteUrl = body?.siteUrl?.trim().replace(/\/$/, "");
  const wpUser = body?.wpUser?.trim();
  const wpAppPassword = body?.wpAppPassword?.trim();
  const hostname = normalizeWhitelistDomain(body?.hostname ?? "");

  if (!siteUrl || !wpUser || !wpAppPassword || !hostname) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  const appUrl = requirePublicAppUrl();
  const snippetRes = await fetch(`${appUrl}/api/integration/extension/embed-snippet`, {
    headers: { Authorization: req.headers.get("authorization") ?? "" },
  });
  if (!snippetRes.ok) {
    const err = await snippetRes.json().catch(() => ({}));
    return NextResponse.json(err, { status: snippetRes.status });
  }
  const snippet = (await snippetRes.json()) as {
    embedScript?: string;
    embedKey?: string;
    tenantId?: string;
  };

  const credentials = Buffer.from(`${wpUser}:${wpAppPassword}`, "utf8").toString("base64");
  const wpEndpoint = `${siteUrl}/wp-json/zudobot/v1/embed-settings`;

  const wpRes = await fetch(wpEndpoint, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      enabled: true,
      embed_key: snippet.embedKey,
      tenant_id: snippet.tenantId,
      script_url: `${appUrl}/widget.js`,
      hostname,
    }),
  });

  if (wpRes.ok) {
    return NextResponse.json({
      ok: true,
      method: "wordpress_rest",
      hostname,
    });
  }

  return NextResponse.json(
    {
      ok: false,
      method: "wordpress_rest",
      status: wpRes.status,
      error: "wp_rest_failed",
      fallback: "executeScript",
      embedScript: snippet.embedScript,
    },
    { status: 502 }
  );
}
