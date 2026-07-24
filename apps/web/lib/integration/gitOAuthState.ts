import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { AMPLIFY_CONFIG } from "@/lib/env/amplifyGuardrail";
import type { GitProviderName } from "@/lib/gitProviders/types";

// Stateless CSRF `state` param for the git-connect OAuth flows — same
// HMAC-signed base64url pattern as lib/integration/extensionAuth.ts's
// extension access token, no DB round-trip needed before the redirect.

const STATE_TTL_SEC = 10 * 60; // 10 min — just needs to survive one redirect round-trip

interface StatePayload {
  tenantId: string;
  provider: GitProviderName;
  nonce: string;
  exp: number;
}

function base64UrlEncode(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}
function base64UrlDecode(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

export function mintGitOAuthState(tenantId: string, provider: GitProviderName): string {
  const payload: StatePayload = {
    tenantId,
    provider,
    nonce: randomBytes(9).toString("base64url"),
    exp: Math.floor(Date.now() / 1000) + STATE_TTL_SEC,
  };
  const body = base64UrlEncode(JSON.stringify(payload));
  const sig = createHmac("sha256", AMPLIFY_CONFIG.authSecret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyGitOAuthState(
  state: string | null | undefined,
  expectedProvider: GitProviderName
): { tenantId: string } | null {
  if (!state?.trim()) return null;
  const [body, sig] = state.trim().split(".");
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
    const parsed = JSON.parse(base64UrlDecode(body)) as Partial<StatePayload>;
    if (!parsed.tenantId || !parsed.provider || !parsed.exp) return null;
    if (parsed.provider !== expectedProvider) return null;
    if (parsed.exp < Math.floor(Date.now() / 1000)) return null;
    return { tenantId: parsed.tenantId };
  } catch {
    return null;
  }
}
