import { NextRequest, NextResponse } from "next/server";
import { resolveContextToken } from "@/lib/channels/ContextTokenService";

export const dynamic = "force-dynamic";

// Allow cross-origin calls from tenant websites
function cors(origin: string) {
  return {
    "Access-Control-Allow-Origin":  origin || "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age":       "86400",
  };
}

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get("origin") ?? "*";
  return new NextResponse(null, { status: 204, headers: cors(origin) });
}

/**
 * GET /api/widget/ctx/:token
 * Resolves a single-use context token created by mdw_omni_zdb_chat.
 * Returns { initialMessage, platformName, displayName? } or 404 if expired/not found.
 * Token is deleted on first use.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { token: string } },
) {
  const origin = req.headers.get("origin") ?? "*";
  const tok = params.token?.slice(0, 8);
  console.log(`[ctx] GET token=${tok} origin=${origin}`);

  const payload = await resolveContextToken(params.token);
  if (!payload) {
    console.warn(`[ctx] token_not_found token=${tok}`);
    return NextResponse.json(
      { ok: false, error: "token_not_found" },
      { status: 404, headers: cors(origin) },
    );
  }

  console.log(`[ctx] resolved token=${tok} msg="${payload.initialMessage?.slice(0, 30)}"`);
  return NextResponse.json(
    {
      ok:             true,
      initialMessage: payload.initialMessage,
      platformName:   payload.platformName,
      displayName:    payload.displayName ?? null,
    },
    { status: 200, headers: cors(origin) },
  );
}
