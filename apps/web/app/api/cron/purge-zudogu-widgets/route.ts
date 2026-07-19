import { NextRequest, NextResponse } from "next/server";
import { purgeInternalWidgetTenants } from "@/lib/admin/purgeInternalWidgetTenants";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const secret =
    req.headers.get("x-cron-secret") ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();

  if (!secret || secret !== process.env.INTERNAL_CRON_SECRET?.trim()) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const dryRun = req.nextUrl.searchParams.get("dryRun") === "1";
    const result = await purgeInternalWidgetTenants(dryRun);
    return NextResponse.json({ ok: true, ...result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "purge_failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
