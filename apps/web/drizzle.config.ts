import type { Config } from "drizzle-kit";

// CLI-only config (drizzle-kit generate/migrate/studio) — not part of the
// deployed app bundle, so reading process.env directly here is fine; it
// does not go through the Amplify env guardrail. Run locally with
// DATABASE_URL set (e.g. via `npm run dev:amplify` or a local shell export).
export default {
  schema: "./lib/db/pg/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
} satisfies Config;
