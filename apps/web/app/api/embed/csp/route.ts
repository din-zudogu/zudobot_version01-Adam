import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { TenantProfileModel } from "@/lib/db/models/TenantProfile";

// ── In-process cache (Node.js runtime, survives warm Lambda invocations) ──
// Avoids a DB round-trip on every /embed page load.
const cache = new Map<string, { domains: string[]; expiresAt: number }>();
const TTL   = 5 * 60 * 1000; // 5 minutes

// ── GET /api/embed/csp?key={embedKey} ─────────────────────────────
// Internal-only route called by middleware.ts to build a per-tenant
// Content-Security-Policy frame-ancestors header.
// Protected by INTERNAL_CRON_SECRET so it is not queryable from outside.

export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-internal-secret");
  if (!process.env.INTERNAL_CRON_SECRET || secret !== process.env.INTERNAL_CRON_SECRET) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const key = req.nextUrl.searchParams.get("key");
  if (!key) return NextResponse.json({ domains: [] });

  // Cache hit
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) {
    return NextResponse.json({ domains: hit.domains });
  }

  // Cache miss — query DB
  await connectDB();
  const profile = await TenantProfileModel.findOne({ embedKey: key })
    .select("allowedDomains widgetEnabled")
    .lean();

  const domains: string[] = profile?.widgetEnabled ? (profile.allowedDomains ?? []) : [];
  cache.set(key, { domains, expiresAt: Date.now() + TTL });

  return NextResponse.json({ domains });
}
