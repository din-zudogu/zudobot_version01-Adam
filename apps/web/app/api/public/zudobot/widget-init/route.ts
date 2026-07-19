import { NextRequest, NextResponse } from "next/server";
import { validateGlobalEmbedAccess } from "@/lib/platform/validateGlobalEmbedAccess";

export const dynamic = "force-dynamic";

function securityHeaders(corsOrigin: string): HeadersInit {
  return {
    "Access-Control-Allow-Origin": corsOrigin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
  };
}

export async function GET(req: NextRequest) {
  const originHeader = req.headers.get("origin");
  const refererHeader = req.headers.get("referer");

  try {
    if (!process.env.MONGO_URI) {
      throw new Error(
        "CRITICAL SECURITY ERROR: MONGO_URI string is absent inside AWS Amplify system properties."
      );
    }

    const { searchParams } = new URL(req.url);
    const embedKey = searchParams.get("embedKey");
    const tenantId = searchParams.get("tenantId");

    if (tenantId) {
      return NextResponse.json(
        { error: "Bad Request: Use embedKey only for platform multi-domain embed" },
        { status: 400 }
      );
    }

    const access = await validateGlobalEmbedAccess(embedKey, originHeader, refererHeader);
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const { config, corsOrigin } = access;

    return NextResponse.json(
      {
        success: true,
        settings: {
          botName: config.botName,
          welcomeMessage: config.welcomeMessage,
          themeColor: config.themeColor,
          avatarUrl: config.avatarUrl,
        },
      },
      { status: 200, headers: securityHeaders(corsOrigin) }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "server_error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function OPTIONS(req: NextRequest) {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error(
        "CRITICAL SECURITY ERROR: MONGO_URI string is absent inside AWS Amplify system properties."
      );
    }

    const originHeader = req.headers.get("origin");
    const refererHeader = req.headers.get("referer");

    const { searchParams } = new URL(req.url);
    const embedKey = searchParams.get("embedKey");

    const access = await validateGlobalEmbedAccess(embedKey, originHeader, refererHeader);
    if (!access.ok) {
      return new NextResponse(null, { status: access.status });
    }

    return new NextResponse(null, {
      status: 204,
      headers: securityHeaders(access.corsOrigin),
    });
  } catch {
    return new NextResponse(null, { status: 500 });
  }
}
