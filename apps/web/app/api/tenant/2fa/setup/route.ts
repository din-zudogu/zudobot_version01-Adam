/**
 * POST /api/tenant/2fa/setup
 * Generates a new TOTP secret and returns the otpauth URI for QR code display.
 * Does NOT enable 2FA until the user verifies the first code via /api/tenant/2fa/verify.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { connectDB } from "@/lib/db/connect";
import { UserModel } from "@/lib/db/models/User";
import { generateTotpSecret, buildOtpAuthUri } from "@/lib/auth/totp";

export async function POST(req: NextRequest) {
  const token = await getServerToken(req);
  if (!token?.sub || token.role !== "tenant") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();
    const user = await UserModel.findById(token.sub);
    if (!user) return NextResponse.json({ error: "user_not_found" }, { status: 404 });

    const secret = generateTotpSecret();
    const uri    = buildOtpAuthUri(secret, user.email);

    // Save secret but don't enable 2FA yet
    await UserModel.updateOne(
      { _id: token.sub },
      { $set: { twoFactorSecret: secret, twoFactorVerified: false } }
    );

    return NextResponse.json({ secret, uri });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
