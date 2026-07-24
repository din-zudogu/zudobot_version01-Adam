import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { getJobById } from "@/lib/db/gitInstall";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = await getServerToken(req);
  if (!token?.sub) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const jobId = req.nextUrl.searchParams.get("jobId");
  if (!jobId) {
    return NextResponse.json({ error: "missing_job_id" }, { status: 400 });
  }

  const job = await getJobById(jobId);
  if (!job || job.tenantId !== token.sub) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json(
    {
      status: job.status,
      pullRequestUrl: job.pullRequestUrl,
      errorMessage: job.errorMessage,
    },
    { status: 200 }
  );
}
