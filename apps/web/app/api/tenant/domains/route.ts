/**
 * /api/tenant/domains
 * Manage single allowed domain per tenant (1 slot = 1 domain).
 *
 * GET    — returns { domain: string | null }
 * PATCH  — { domain: string } — set or replace the domain
 * DELETE — clear the domain
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { connectDB } from "@/lib/db/connect";
import { TenantProfileModel } from "@/lib/db/models/TenantProfile";

function normalizeHostname(raw: string): string | null {
  try {
    const url = raw.trim().startsWith("http") ? raw.trim() : `https://${raw.trim()}`;
    const { hostname } = new URL(url);
    if (!hostname || hostname.length < 3 || !hostname.includes(".")) return null;
    // Reject if it looks like multiple domains (comma or space separated)
    if (hostname.includes(",") || hostname.includes(" ")) return null;
    return hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const token = await getServerToken(req);
  if (!token?.sub) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  await connectDB();
  const profile = await TenantProfileModel.findOne({ tenantId: token.sub })
    .select("allowedDomain allowedDomains").lean();

  const domain = profile?.allowedDomain || profile?.allowedDomains?.[0] || null;
  return NextResponse.json({ domain });
}

export async function PATCH(req: NextRequest) {
  const token = await getServerToken(req);
  if (!token?.sub) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { domain?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid_body" }, { status: 400 }); }

  if (!body.domain) return NextResponse.json({ error: "missing_domain" }, { status: 400 });

  // Block comma/space to prevent multi-domain smuggling
  if (body.domain.includes(",") || /\s/.test(body.domain)) {
    return NextResponse.json({ error: "single_domain_only" }, { status: 400 });
  }

  const hostname = normalizeHostname(body.domain);
  if (!hostname) return NextResponse.json({ error: "invalid_domain" }, { status: 400 });

  await connectDB();
  await TenantProfileModel.updateOne(
    { tenantId: token.sub },
    { $set: { allowedDomain: hostname, allowedDomains: [hostname] } }
  );

  return NextResponse.json({ ok: true, domain: hostname });
}

export async function DELETE(req: NextRequest) {
  const token = await getServerToken(req);
  if (!token?.sub) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  await connectDB();
  await TenantProfileModel.updateOne(
    { tenantId: token.sub },
    { $set: { allowedDomain: "", allowedDomains: [] } }
  );

  return NextResponse.json({ ok: true });
}
