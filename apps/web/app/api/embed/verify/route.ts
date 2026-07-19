import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { TenantProfileModel } from "@/lib/db/models/TenantProfile";

// ── Helpers ───────────────────────────────────────────────────────

function normalizeHostname(raw: string): string | null {
  try {
    const url = raw.trim().startsWith("http") ? raw.trim() : `https://${raw.trim()}`;
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

function isLocalhost(origin: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    // Browser caches the result for 5 min — avoids blocking on repeat loads
    "Cache-Control": "public, max-age=300",
  };
}

// ── CORS preflight ────────────────────────────────────────────────

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

// ── GET /api/embed/verify?key={embedKey}&origin={origin} ──────────
// Layer 1: pre-flight domain check called by the loader script before
// creating the iframe. Returns { allowed: boolean }.
// Response is browser-cached (max-age=300) to avoid blocking page load.

export async function GET(req: NextRequest) {
  const key    = req.nextUrl.searchParams.get("key");
  const origin = req.nextUrl.searchParams.get("origin");

  if (!key || !origin) {
    return NextResponse.json({ allowed: false }, { status: 400, headers: corsHeaders() });
  }

  // Always allow localhost for local development
  if (isLocalhost(origin)) {
    return NextResponse.json({ allowed: true }, { headers: corsHeaders() });
  }

  const hostname = normalizeHostname(origin);
  if (!hostname) {
    return NextResponse.json({ allowed: false }, { status: 400, headers: corsHeaders() });
  }

  await connectDB();
  const profile = await TenantProfileModel.findOne({ embedKey: key })
    .select("widgetEnabled allowedDomains")
    .lean();

  if (!profile || !profile.widgetEnabled) {
    return NextResponse.json({ allowed: false }, { status: 403, headers: corsHeaders() });
  }

  const isAllowed = profile.allowedDomains.some(
    (d) => d.toLowerCase().replace(/^www\./, "") === hostname
  );

  return NextResponse.json({ allowed: isAllowed }, { headers: corsHeaders() });
}
