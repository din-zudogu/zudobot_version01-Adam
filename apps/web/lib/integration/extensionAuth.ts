import { createHmac, timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { AMPLIFY_CONFIG } from "@/lib/env/amplifyGuardrail";

const EXTENSION_TOKEN_TTL_SEC = 60 * 60; // 1 hour

export type ExtensionAuthContext = {
  sub: string;
  role: string;
};

function base64UrlEncode(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

function base64UrlDecode(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

export function isAllowedExtensionRedirectUri(uri: string): boolean {
  try {
    const u = new URL(uri);
    return (
      u.protocol === "https:" &&
      /^[a-p]{32}\.chromiumapp\.org$/i.test(u.hostname) &&
      (u.pathname === "/" || u.pathname === "")
    );
  } catch {
    return false;
  }
}

export function createExtensionAccessToken(ctx: {
  sub: string;
  role: string;
}): { accessToken: string; expiresIn: number } {
  const exp = Math.floor(Date.now() / 1000) + EXTENSION_TOKEN_TTL_SEC;
  const payload = JSON.stringify({ sub: ctx.sub, role: ctx.role, exp });
  const body = base64UrlEncode(payload);
  const sig = createHmac("sha256", AMPLIFY_CONFIG.authSecret)
    .update(body)
    .digest("base64url");
  return { accessToken: `${body}.${sig}`, expiresIn: EXTENSION_TOKEN_TTL_SEC };
}

export function verifyExtensionAccessToken(
  token: string | null | undefined
): ExtensionAuthContext | null {
  if (!token?.trim()) return null;
  const [body, sig] = token.trim().split(".");
  if (!body || !sig) return null;

  const expected = createHmac("sha256", AMPLIFY_CONFIG.authSecret)
    .update(body)
    .digest("base64url");

  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }

  try {
    const parsed = JSON.parse(base64UrlDecode(body)) as {
      sub?: string;
      role?: string;
      exp?: number;
    };
    if (!parsed.sub || !parsed.role || !parsed.exp) return null;
    if (parsed.exp < Math.floor(Date.now() / 1000)) return null;
    return { sub: parsed.sub, role: parsed.role };
  } catch {
    return null;
  }
}

/** Cookie session (dashboard) or Bearer extension token */
export async function resolveIntegrationAuth(
  req: NextRequest
): Promise<ExtensionAuthContext | null> {
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  const fromBearer = verifyExtensionAccessToken(bearer);
  if (fromBearer) return fromBearer;

  const session = await getServerToken(req);
  if (!session?.sub || !session.role) return null;
  return { sub: session.sub as string, role: session.role as string };
}
