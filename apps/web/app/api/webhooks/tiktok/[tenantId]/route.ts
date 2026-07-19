import { NextRequest, NextResponse } from "next/server";
import { mdw_omni_zdb_chat } from "@/lib/channels/mdw_omni_zdb_chat";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { tenantId: string } },
) {
  const rawBody = await req.text();
  const headers: Record<string, string> = {};
  req.headers.forEach((v, k) => { headers[k] = v; });

  const result = await mdw_omni_zdb_chat("tiktok", params.tenantId, rawBody, headers);
  return NextResponse.json({ ok: result.ok }, { status: result.status });
}
