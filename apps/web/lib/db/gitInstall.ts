import { and, desc, eq, sql } from "drizzle-orm";
import { getPostgresDb } from "@/lib/db/postgres";
import { gitConnections, gitInstallJobs } from "@/lib/db/pg/schema";
import type { GitProviderName } from "@/lib/gitProviders/types";

// Thin query helpers over the two git-connect tables — keeps route handlers
// free of raw Drizzle query-building and centralizes the couple of
// non-obvious queries (active-connection lookup, atomic job claim).

export type GitConnectionRow = typeof gitConnections.$inferSelect;
export type GitInstallJobRow = typeof gitInstallJobs.$inferSelect;

export async function getActiveConnection(tenantId: string): Promise<GitConnectionRow | null> {
  const db = getPostgresDb();
  const [row] = await db
    .select()
    .from(gitConnections)
    .where(and(eq(gitConnections.tenantId, tenantId), eq(gitConnections.status, "connected")))
    .orderBy(desc(gitConnections.createdAt))
    .limit(1);
  return row ?? null;
}

export async function getConnectionById(id: string): Promise<GitConnectionRow | null> {
  const db = getPostgresDb();
  const [row] = await db.select().from(gitConnections).where(eq(gitConnections.id, id)).limit(1);
  return row ?? null;
}

export async function upsertConnection(input: {
  tenantId: string;
  provider: GitProviderName;
  authMethod: "oauth" | "iam_keys" | "iam_role";
  accountLabel?: string;
  accessTokenEnc?: string;
  refreshTokenEnc?: string;
  tokenExpiresAt?: Date;
  iamAccessKeyIdEnc?: string;
  awsRegion?: string;
  roleArn?: string;
  externalIdEnc?: string;
}): Promise<GitConnectionRow> {
  const db = getPostgresDb();

  // Revoke any prior active connection for this tenant+provider before
  // inserting a fresh one — "one active connection per tenant" is an
  // application-layer rule (no DB unique constraint), see plan §1.
  await db
    .update(gitConnections)
    .set({ status: "revoked", updatedAt: new Date() })
    .where(and(eq(gitConnections.tenantId, input.tenantId), eq(gitConnections.status, "connected")));

  const [row] = await db
    .insert(gitConnections)
    .values({ ...input, status: "connected" })
    .returning();
  return row;
}

export async function setConnectionRepo(
  id: string,
  repoIdentifier: string,
  repoUrl: string,
  defaultBranch: string
): Promise<GitConnectionRow | null> {
  const db = getPostgresDb();
  const [row] = await db
    .update(gitConnections)
    .set({ repoIdentifier, repoUrl, defaultBranch, updatedAt: new Date() })
    .where(eq(gitConnections.id, id))
    .returning();
  return row ?? null;
}

export async function revokeConnection(id: string, tenantId: string): Promise<void> {
  const db = getPostgresDb();
  await db
    .update(gitConnections)
    .set({ status: "revoked", updatedAt: new Date() })
    .where(and(eq(gitConnections.id, id), eq(gitConnections.tenantId, tenantId)));
}

// ── Install jobs ──────────────────────────────────────────────────────────

export async function createInstallJob(connectionId: string, tenantId: string): Promise<GitInstallJobRow> {
  const db = getPostgresDb();
  const [row] = await db
    .insert(gitInstallJobs)
    .values({ connectionId, tenantId, status: "pending" })
    .returning();
  return row;
}

export async function getJobById(id: string): Promise<GitInstallJobRow | null> {
  const db = getPostgresDb();
  const [row] = await db.select().from(gitInstallJobs).where(eq(gitInstallJobs.id, id)).limit(1);
  return row ?? null;
}

export async function updateJob(
  id: string,
  patch: Partial<Omit<GitInstallJobRow, "id" | "createdAt">>
): Promise<void> {
  const db = getPostgresDb();
  await db
    .update(gitInstallJobs)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(gitInstallJobs.id, id));
}

/**
 * Atomically claim the oldest eligible job: still `pending`, or `analyzing`
 * but stale (no checkpoint in >2min, meaning a previous worker tick died
 * mid-run). Single UPDATE...RETURNING — no separate SELECT-then-UPDATE race.
 */
export async function claimNextInstallJob(): Promise<GitInstallJobRow | null> {
  const db = getPostgresDb();
  const rows = await db.execute(sql`
    UPDATE git_install_jobs
    SET status = 'analyzing', updated_at = now(), started_at = COALESCE(started_at, now())
    WHERE id = (
      SELECT id FROM git_install_jobs
      WHERE status = 'pending'
         OR (status = 'analyzing' AND updated_at < now() - interval '2 minutes')
      ORDER BY created_at
      LIMIT 1
    )
    RETURNING *
  `);
  const result = rows as unknown as { rows?: GitInstallJobRow[] } | GitInstallJobRow[];
  const row = Array.isArray(result) ? result[0] : result.rows?.[0];
  return row ?? null;
}
