/**
 * POST /api/auth/verify-2fa
 *
 * Validates the TOTP code for a user who has 2FA pending.
 * On success, sets an httpOnly cookie `zudo-2fa-ok` = userId
 * so the middleware lets them through.
 *
 * Body: { code: "123456" }
 * Requires: valid NextAuth JWT (user is logged in but 2FA pending)
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { connectDB } from "@/lib/db/connect";
import { UserModel } from "@/lib/db/models/User";
import { verifyTotp } from "@/lib/auth/totp";
import { AMPLIFY_CONFIG } from "@/lib/env/amplifyGuardrail";

const COOKIE_NAME    = "zudo-2fa-ok";
const COOKIE_MAX_AGE = 60 * 60 * 8; // 8 hours

export async function POST(req: NextRequest) {
  const token = await getServerToken(req);
  // Allow even if twoFaPending (user is logged in but 2FA not yet verified)
  if (!token?.sub) {
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
    const user = await UserModel.findById(token.sub).select("twoFactorEnabled twoFactorSecret twoFactorVerified");
    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
      return NextResponse.json({ error: "2fa_not_configured" }, { status: 400 });
    }

    const valid = await verifyTotp(user.twoFactorSecret, body.code);
    if (!valid) {
      return NextResponse.json({ error: "invalid_code" }, { status: 400 });
    }

    // Set httpOnly cookie that middleware will recognize
    const isSecure = AMPLIFY_CONFIG.authUrl.startsWith("https://");
    const res = NextResponse.json({ ok: true });
    res.cookies.set(COOKIE_NAME, token.sub, {
      httpOnly: true,
      secure:   isSecure,
      sameSite: "lax",
      maxAge:   COOKIE_MAX_AGE,
      path:     "/",
    });
    return res;
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
