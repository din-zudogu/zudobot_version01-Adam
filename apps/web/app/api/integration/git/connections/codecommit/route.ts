import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { CodeCommitProviderClient } from "@/lib/gitProviders/codecommit";
import { encryptGitToken } from "@/lib/integration/gitTokenCrypto";
import { upsertConnection } from "@/lib/db/gitInstall";

export const dynamic = "force-dynamic";

interface Body {
  accessKeyId?: string;
  secretAccessKey?: string;
  region?: string;
}

export async function POST(req: NextRequest) {
  const token = await getServerToken(req);
  if (!token?.sub) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as Body | null;
  const accessKeyId = body?.accessKeyId?.trim();
  const secretAccessKey = body?.secretAccessKey?.trim();
  const region = body?.region?.trim();

  if (!accessKeyId || !secretAccessKey || !region) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  // Verify before saving — a cheap read-only call catches bad/typo'd keys
  // immediately instead of persisting broken credentials silently.
  try {
    const testClient = new CodeCommitProviderClient({
      provider: "codecommit",
      authMethod: "iam_keys",
      accessToken: secretAccessKey,
      iamAccessKeyId: accessKeyId,
      awsRegion: region,
    });
    await testClient.listRepositories();
  } catch (err) {
    console.error("[git/connections/codecommit] credential verification failed:", err);
    return NextResponse.json({ error: "invalid_aws_credentials" }, { status: 400 });
  }

  const row = await upsertConnection({
    tenantId: token.sub as string,
    provider: "codecommit",
    authMethod: "iam_keys",
    accountLabel: `AWS ${region}`,
    accessTokenEnc: encryptGitToken(secretAccessKey),
    iamAccessKeyIdEnc: encryptGitToken(accessKeyId),
    awsRegion: region,
  });

  return NextResponse.json({ ok: true, connectionId: row.id }, { status: 200 });
}
