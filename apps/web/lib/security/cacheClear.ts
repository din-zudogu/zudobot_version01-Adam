/**
 * "Clear cache" for an account — concretely scoped to this account's Upstash
 * rate-limit keys, since that is the only cache-like state in the system today
 * (no data cache exists beyond anti-abuse rate limiting, see lib/security/rateLimit.ts).
 *
 * Fail-open: any Redis error returns {deletedCount:0, skipped:true} rather than
 * failing the whole admin action.
 */
import { Redis } from "@upstash/redis";
import { TenantProfileModel } from "@/lib/db/models/TenantProfile";

export interface ClearCacheResult {
  deletedCount: number;
  skipped: boolean;
}

let _client: Redis | null | undefined;

function getClient(): Redis | null {
  if (_client !== undefined) return _client;
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    _client = null;
    return null;
  }
  try {
    _client = Redis.fromEnv();
  } catch (e) {
    console.error("[cacheClear] Redis init failed:", e instanceof Error ? e.message : e);
    _client = null;
  }
  return _client;
}

async function scanAndDelete(client: Redis, pattern: string): Promise<number> {
  let cursor = 0;
  let deleted = 0;
  do {
    const [next, keys] = await client.scan(cursor, { match: pattern, count: 100 });
    cursor = Number(next);
    if (keys.length > 0) {
      deleted += await client.del(...keys);
    }
  } while (cursor !== 0);
  return deleted;
}

/** Clears anti-abuse rate-limit counters for this email — not any tenant business data. */
export async function clearRateLimitKeysForEmail(email: string, tenantId?: string): Promise<ClearCacheResult> {
  const client = getClient();
  if (!client) return { deletedCount: 0, skipped: true };

  try {
    const patterns = [
      `pwreset:*:${email}`,
      `pwreset-confirm:*:${email}`,
    ];

    if (tenantId) {
      const profile = await TenantProfileModel.findOne({ tenantId }).select("embedKey").lean() as { embedKey?: string } | null;
      if (profile?.embedKey) {
        patterns.push(`zudo:widget:rl:*:${profile.embedKey}`);
        patterns.push(`zudo:embed:rl:*:${profile.embedKey}`);
      }
    }

    let deletedCount = 0;
    for (const pattern of patterns) {
      deletedCount += await scanAndDelete(client, pattern);
    }
    return { deletedCount, skipped: false };
  } catch (e) {
    console.error("[cacheClear] clearRateLimitKeysForEmail failed:", e instanceof Error ? e.message : e);
    return { deletedCount: 0, skipped: true };
  }
}
