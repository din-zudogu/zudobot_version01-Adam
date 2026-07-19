import { NextRequest, NextResponse } from "next/server";
import { mdw_omni_zdb_chat } from "@/lib/channels/mdw_omni_zdb_chat";
import { connectDB } from "@/lib/db/connect";
import { TenantProfileModel } from "@/lib/db/models/TenantProfile";

export const dynamic = "force-dynamic";

/** Meta webhook verification challenge (one-time setup) */
export async function GET(
  req: NextRequest,
  { params }: { params: { tenantId: string } },
) {
  const { searchParams } = new URL(req.url);
  const mode      = searchParams.get("hub.mode");
  const challenge = searchParams.get("hub.challenge");
  const token     = searchParams.get("hub.verify_token");

  if (mode !== "subscribe" || !challenge || !token) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  await connectDB();
  const profile = await TenantProfileModel.findOne({ tenantId: params.tenantId }).lean();
  if (!profile || profile.metaVerifyToken !== token) {
    return NextResponse.json({ error: "verify_token_mismatch" }, { status: 403 });
  }

  return new NextResponse(challenge, { status: 200 });
}

/** Meta webhook event (Facebook Messenger + Instagram DM) */
export async function POST(
  req: NextRequest,
  { params }: { params: { tenantId: string } },
) {
  const rawBody = await req.text();
  const headers: Record<string, string> = {};
  req.headers.forEach((v, k) => { headers[k] = v; });

  // Detect platform from payload object field
  let platform = "facebook";
  try {
    const body = JSON.parse(rawBody) as { object?: string };
    if (body.object === "instagram") platform = "instagram";
  } catch { /* default to facebook */ }

  const result = await mdw_omni_zdb_chat(platform, params.tenantId, rawBody, headers);
  return NextResponse.json({ ok: result.ok }, { status: result.status });
}
