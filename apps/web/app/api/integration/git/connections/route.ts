import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { getActiveConnection } from "@/lib/db/gitInstall";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = await getServerToken(req);
  if (!token?.sub) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const connection = await getActiveConnection(token.sub as string);
  if (!connection) {
    return NextResponse.json({ connection: null }, { status: 200 });
  }

  // Never return encrypted tokens to the client.
  const { accessTokenEnc, refreshTokenEnc, iamAccessKeyIdEnc, ...safe } = connection;
  void accessTokenEnc;
  void refreshTokenEnc;
  void iamAccessKeyIdEnc;
  return NextResponse.json({ connection: safe }, { status: 200 });
}
