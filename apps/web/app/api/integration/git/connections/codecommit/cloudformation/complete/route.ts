import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { verifyAwsRoleStateToken } from "@/lib/integration/awsRoleState";
import { encryptGitToken } from "@/lib/integration/gitTokenCrypto";
import { upsertConnection } from "@/lib/db/gitInstall";
import { CodeCommitProviderClient } from "@/lib/gitProviders/codecommit";

export const dynamic = "force-dynamic";

interface Body {
  roleArn?: string;
  region?: string;
  externalIdToken?: string;
}

export async function POST(req: NextRequest) {
  const token = await getServerToken(req);
  if (!token?.sub) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as Body | null;
  const roleArn = body?.roleArn?.trim();
  const region = body?.region?.trim();

  const verified = verifyAwsRoleStateToken(body?.externalIdToken);
  if (!verified || verified.tenantId !== token.sub) {
    return NextResponse.json({ error: "invalid_or_expired_state" }, { status: 400 });
  }
  if (!roleArn || !region) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  // Verify the role actually assumes and can see CodeCommit before saving —
  // catches a copy-paste mistake or a stack that failed to create properly.
  try {
    const testClient = new CodeCommitProviderClient({
      provider: "codecommit",
      authMethod: "iam_role",
      roleArn,
      externalId: verified.externalId,
      awsRegion: region,
    });
    await testClient.listRepositories();
  } catch (err) {
    console.error("[git/connections/codecommit/cloudformation/complete] AssumeRole verification failed:", err);
    return NextResponse.json({ error: "assume_role_failed" }, { status: 400 });
  }

  const row = await upsertConnection({
    tenantId: token.sub as string,
    provider: "codecommit",
    authMethod: "iam_role",
    accountLabel: `AWS ${region} (Role)`,
    roleArn,
    externalIdEnc: encryptGitToken(verified.externalId),
    awsRegion: region,
  });

  return NextResponse.json({ ok: true, connectionId: row.id }, { status: 200 });
}
