import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { getConnectionById, revokeConnection, setConnectionRepo } from "@/lib/db/gitInstall";
import { getGitProviderClient } from "@/lib/gitProviders";

export const dynamic = "force-dynamic";

interface Body {
  repoIdentifier?: string;
  defaultBranch?: string;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const token = await getServerToken(req);
  if (!token?.sub) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const connection = await getConnectionById(params.id);
  if (!connection || connection.tenantId !== token.sub) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const body = (await req.json().catch(() => null)) as Body | null;
  const repoIdentifier = body?.repoIdentifier?.trim();
  const defaultBranch = body?.defaultBranch?.trim() || "main";
  if (!repoIdentifier) {
    return NextResponse.json({ error: "missing_repo_identifier" }, { status: 400 });
  }

  // Re-validate access to the chosen repo/branch before saving — catches a
  // stale/incorrect selection immediately rather than failing later inside
  // the agent run.
  try {
    const client = getGitProviderClient(connection);
    await client.listTree(repoIdentifier, defaultBranch, "");
  } catch (err) {
    console.error("[git/connections/:id PATCH] repo validation failed:", err);
    return NextResponse.json({ error: "repo_not_accessible" }, { status: 400 });
  }

  const updated = await setConnectionRepo(params.id, repoIdentifier, "", defaultBranch);
  return NextResponse.json({ ok: true, connection: updated }, { status: 200 });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const token = await getServerToken(req);
  if (!token?.sub) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  await revokeConnection(params.id, token.sub as string);
  return NextResponse.json({ ok: true }, { status: 200 });
}
