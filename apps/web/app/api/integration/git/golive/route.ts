import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { getJobById, getConnectionById, updateJob } from "@/lib/db/gitInstall";
import { getGitProviderClient } from "@/lib/gitProviders";

export const dynamic = "force-dynamic";

interface Body {
  jobId?: string;
}

/**
 * The ONLY code path in this feature that touches production — structurally
 * the only route that calls mergePullRequest, which is never exposed to the
 * Claude agent's tool surface. Requires an authenticated tenant and an
 * explicit request; the frontend shows a confirm dialog before calling this.
 */
export async function POST(req: NextRequest) {
  const token = await getServerToken(req);
  if (!token?.sub) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as Body | null;
  const jobId = body?.jobId;
  if (!jobId) {
    return NextResponse.json({ error: "missing_job_id" }, { status: 400 });
  }

  const job = await getJobById(jobId);
  if (!job || job.tenantId !== token.sub) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (job.status !== "pr_open" || !job.pullRequestId) {
    return NextResponse.json({ error: "not_ready" }, { status: 409 });
  }

  const connection = await getConnectionById(job.connectionId);
  if (!connection || !connection.repoIdentifier) {
    return NextResponse.json({ error: "connection_not_found" }, { status: 404 });
  }

  try {
    const client = getGitProviderClient(connection);
    await client.mergePullRequest(connection.repoIdentifier, job.pullRequestId);
    await updateJob(job.id, { status: "live" });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("[git/golive] merge failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "merge_failed" }, { status: 502 });
  }
}
