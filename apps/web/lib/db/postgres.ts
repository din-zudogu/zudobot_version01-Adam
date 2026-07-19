import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { AMPLIFY_CONFIG } from "@/lib/env/amplifyGuardrail";
import * as schema from "./pg/schema";

type PostgresDb = ReturnType<typeof drizzle<typeof schema>>;

let cached: PostgresDb | null = null;

/**
 * PostgreSQL (Neon) — for new features/modules only. MongoDB remains the
 * database for everything that already exists.
 *
 * Throws if DATABASE_URL isn't configured — callers should only invoke this
 * from Postgres-backed features, not from shared/existing code paths, since
 * DATABASE_URL is optional (not part of the Amplify env guardrail's required set).
 */
export function getPostgresDb(): PostgresDb {
  if (cached) return cached;

  const url = AMPLIFY_CONFIG.databaseUrl;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set — this feature requires PostgreSQL (Neon), which is not configured for this environment."
    );
  }

  cached = drizzle(neon(url), { schema });
  return cached;
}
