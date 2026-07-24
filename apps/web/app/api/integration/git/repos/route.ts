import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { getConnectionById } from "@/lib/db/gitInstall";
import { getGitProviderClient } from "@/lib/gitProviders";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = await getServerToken(req);
  if (!token?.sub) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const connectionId = req.nextUrl.searchParams.get("connectionId");
  if (!connectionId) {
    return NextResponse.json({ error: "missing_connection_id" }, { status: 400 });
  }

  const connection = await getConnectionById(connectionId);
  if (!connection || connection.tenantId !== token.sub) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  try {
    const client = getGitProviderClient(connection);
    const repos = await client.listRepositories();
    return NextResponse.json({ repos }, { status: 200 });
  } catch (err) {
    console.error("[git/repos] listRepositories failed:", err);
    return NextResponse.json({ error: "repo_list_failed" }, { status: 502 });
  }
}
