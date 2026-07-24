import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { getConnectionById, createInstallJob, updateJob } from "@/lib/db/gitInstall";
import { getGitProviderClient } from "@/lib/gitProviders";
import { requirePublicAppUrl } from "@/lib/env/publicAppUrl";

export const dynamic = "force-dynamic";

interface Body {
  connectionId?: string;
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}

export async function POST(req: NextRequest) {
  const token = await getServerToken(req);
  if (!token?.sub) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as Body | null;
  const connectionId = body?.connectionId;
  if (!connectionId) {
    return NextResponse.json({ error: "missing_connection_id" }, { status: 400 });
  }

  const connection = await getConnectionById(connectionId);
  if (!connection || connection.tenantId !== token.sub) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (!connection.repoIdentifier) {
    return NextResponse.json({ error: "no_repo_selected" }, { status: 400 });
  }

  const job = await createInstallJob(connection.id, connection.tenantId);
  const branchName = `zudobot-widget-install-${randomSuffix()}`;

  try {
    const client = getGitProviderClient(connection);
    await client.createBranch(connection.repoIdentifier, connection.defaultBranch, branchName);
    await updateJob(job.id, { branchName, startedAt: new Date() });
  } catch (err) {
    await updateJob(job.id, {
      status: "failed",
      errorMessage: `branch_creation_failed: ${err instanceof Error ? err.message : String(err)}`,
      completedAt: new Date(),
    });
    return NextResponse.json({ jobId: job.id }, { status: 200 });
  }

  // Best-effort kick to start work immediately rather than waiting for the
  // next scheduled cron tick — never let this fail the request.
  try {
    const workerUrl = `${requirePublicAppUrl()}/api/cron/git-agent-worker`;
    void fetch(workerUrl, {
      method: "POST",
      headers: { "x-cron-secret": process.env.INTERNAL_CRON_SECRET ?? "" },
    }).catch(() => {});
  } catch {
    // ignore — the scheduled EventBridge tick is the reliability backstop
  }

  return NextResponse.json({ jobId: job.id }, { status: 200 });
}
