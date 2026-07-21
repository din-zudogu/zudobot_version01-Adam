/**
 * Redis-backed session revocation ("Force Logout").
 *
 * NextAuth uses a stateless JWT strategy — a token is never re-checked
 * against the DB per request. To let an admin force a live session to log
 * out, we record a revocation instant per user and compare it against the
 * token's `iat` (issued-at) on every request in middleware.ts.
 *
 * It is NOT possible to remotely delete a cookie from a specific browser —
 * the achievable mechanism is server-side invalidation: the *next* request
 * carrying the old token gets bounced to /login.
 *
 * FAIL-OPEN by design (confirmed product decision): if Upstash is unset or
 * unreachable, isSessionRevoked() returns false (not revoked) rather than
 * blocking all authenticated traffic — consistent with this codebase's
 * existing rate-limiter philosophy (see lib/security/rateLimit.ts).
 *
 * Lazy init: the Redis client is built on first use, never at module load.
 *
 * Imported from "@upstash/redis/cloudflare" (not the default Node entry) because
 * this module is used from middleware.ts, which runs on the Edge Runtime —
 * the default nodejs.mjs build touches process.version, which Edge doesn't support.
 */
import { Redis } from "@upstash/redis/cloudflare";

const REVOCATION_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days — matches NextAuth's default JWT maxAge

let _client: Redis | null | undefined; // undefined = not yet attempted, null = unavailable

function getClient(): Redis | null {
  if (_client !== undefined) return _client;
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    _client = null;
    return null;
  }
  try {
    _client = new Redis({
      url:   process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  } catch (e) {
    console.error("[sessionRevocation] Redis init failed — failing open:", e instanceof Error ? e.message : e);
    _client = null;
  }
  return _client;
}

function key(userId: string): string {
  return `zudo:revoked:${userId}`;
}

/** Marks all of a user's existing sessions as revoked from this instant forward. */
export async function revokeUserSessions(userId: string): Promise<void> {
  const client = getClient();
  if (!client) return; // fail-open — no-op if Redis unavailable
  const nowSeconds = Math.floor(Date.now() / 1000);
  try {
    await client.set(key(userId), nowSeconds, { ex: REVOCATION_TTL_SECONDS });
  } catch (e) {
    console.error("[sessionRevocation] revokeUserSessions failed:", e instanceof Error ? e.message : e);
  }
}

/** True only if the user was revoked AFTER this token was issued. Fails open (false) on any Redis error. */
export async function isSessionRevoked(userId: string, tokenIat: number): Promise<boolean> {
  const client = getClient();
  if (!client) return false;
  try {
    const revokedAt = await client.get<number>(key(userId));
    return typeof revokedAt === "number" && revokedAt > tokenIat;
  } catch (e) {
    console.error("[sessionRevocation] isSessionRevoked failed — failing open:", e instanceof Error ? e.message : e);
    return false;
  }
}
