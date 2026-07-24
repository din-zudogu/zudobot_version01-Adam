/**
 * POST /api/cron/git-agent-worker
 *
 * Scheduled cron endpoint — protected by the shared INTERNAL_CRON_SECRET,
 * same auth shape as the other /api/cron/* routes. Triggered on a ~30-60s
 * EventBridge schedule (reliability backstop), and also fired best-effort by
 * /api/integration/git/agent/trigger right after a job is created so work
 * starts immediately rather than waiting for the next tick.
 *
 * Claims the oldest eligible git_install_jobs row and runs the bounded
 * Claude agent loop for it (see lib/gitAgent/runAgent.ts) to a stop
 * condition (pr_open | failed). One job per invocation.
 */
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { TenantProfileModel } from "@/lib/db/models/TenantProfile";
import { claimNextInstallJob, getConnectionById, updateJob } from "@/lib/db/gitInstall";
import { runAgentStep } from "@/lib/gitAgent/runAgent";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.INTERNAL_CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("x-cron-secret");
  const bearer = req.headers.get("authorization");
  return header === secret || bearer === `Bearer ${secret}`;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const job = await claimNextInstallJob();
  if (!job) {
    return NextResponse.json({ ok: true, claimed: false });
  }

  const connection = await getConnectionById(job.connectionId);
  if (!connection) {
    await updateJob(job.id, { status: "failed", errorMessage: "connection_not_found", completedAt: new Date() });
    return NextResponse.json({ ok: true, claimed: true, jobId: job.id, result: "failed" });
  }

  try {
    await connectDB();
    const profile = await TenantProfileModel.findOne({ tenantId: job.tenantId }).lean();
    if (!profile?.embedKey) {
      await updateJob(job.id, { status: "failed", errorMessage: "no_embed_key", completedAt: new Date() });
      return NextResponse.json({ ok: true, claimed: true, jobId: job.id, result: "failed" });
    }

    await runAgentStep({ job, connection, tenantId: job.tenantId, embedKey: profile.embedKey });
    return NextResponse.json({ ok: true, claimed: true, jobId: job.id });
  } catch (err) {
    console.error("[git-agent-worker] job failed:", err instanceof Error ? err.message : err);
    await updateJob(job.id, {
      status: "failed",
      errorMessage: `worker_error: ${err instanceof Error ? err.message : String(err)}`,
      completedAt: new Date(),
    });
    return NextResponse.json({ ok: false, jobId: job.id, error: "internal_error" }, { status: 500 });
  }
}
