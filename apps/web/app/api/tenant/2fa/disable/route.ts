/**
 * POST /api/tenant/2fa/disable
 * Disables 2FA. Requires a valid TOTP code as confirmation.
 * Body: { code: "123456" }
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { connectDB } from "@/lib/db/connect";
import { UserModel } from "@/lib/db/models/User";
import { verifyTotp } from "@/lib/auth/totp";

export async function POST(req: NextRequest) {
  const token = await getServerToken(req);
  if (!token?.sub || token.role !== "tenant") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { code?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid_body" }, { status: 400 }); }

  if (!body.code) {
    return NextResponse.json({ error: "code_required" }, { status: 400 });
  }

  try {
    await connectDB();
    const user = await UserModel.findById(token.sub);
    if (!user) return NextResponse.json({ error: "user_not_found" }, { status: 404 });
    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      return NextResponse.json({ error: "2fa_not_enabled" }, { status: 400 });
    }

    const valid = await verifyTotp(user.twoFactorSecret, body.code);
    if (!valid) {
      return NextResponse.json({ error: "invalid_code" }, { status: 400 });
    }

    await UserModel.updateOne(
      { _id: token.sub },
      { $unset: { twoFactorSecret: 1 }, $set: { twoFactorEnabled: false, twoFactorVerified: false } }
    );

    return NextResponse.json({ ok: true, message: "2FA ปิดใช้งานสำเร็จ" });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
