import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { AMPLIFY_CONFIG } from "@/lib/env/amplifyGuardrail";

// Stateless HMAC-signed token carrying {tenantId, externalId} across the
// CloudFormation Quick-Create round trip — same pattern as
// lib/integration/gitOAuthState.ts's OAuth `state` param. No DB row needed
// just to remember the External ID between "start" and "complete"; the
// customer's browser carries it back to us in the token.

const TOKEN_TTL_SEC = 30 * 60; // 30 min — customer needs time to click through AWS Console

interface TokenPayload {
  tenantId: string;
  externalId: string;
  exp: number;
}

function base64UrlEncode(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}
function base64UrlDecode(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

export function generateExternalId(): string {
  return randomBytes(16).toString("hex");
}

export function mintAwsRoleStateToken(tenantId: string, externalId: string): string {
  const payload: TokenPayload = { tenantId, externalId, exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SEC };
  const body = base64UrlEncode(JSON.stringify(payload));
  const sig = createHmac("sha256", AMPLIFY_CONFIG.authSecret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyAwsRoleStateToken(
  token: string | null | undefined
): { tenantId: string; externalId: string } | null {
  if (!token?.trim()) return null;
  const [body, sig] = token.trim().split(".");
  if (!body || !sig) return null;

  const expected = createHmac("sha256", AMPLIFY_CONFIG.authSecret).update(body).digest("base64url");
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }

  try {
    const parsed = JSON.parse(base64UrlDecode(body)) as Partial<TokenPayload>;
    if (!parsed.tenantId || !parsed.externalId || !parsed.exp) return null;
    if (parsed.exp < Math.floor(Date.now() / 1000)) return null;
    return { tenantId: parsed.tenantId, externalId: parsed.externalId };
  } catch {
    return null;
  }
}
