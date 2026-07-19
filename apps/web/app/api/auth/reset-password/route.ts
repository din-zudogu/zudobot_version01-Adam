import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db/connect";
import { UserModel } from "@/lib/db/models/User";
import { enforceRateLimit, clientIp } from "@/lib/security/rateLimit";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = (body?.email as string | undefined)?.toLowerCase().trim();
  const token = body?.token as string | undefined;
  const newPassword = body?.newPassword as string | undefined;

  if (!email || !token || !newPassword || newPassword.length < 8) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const rate = await enforceRateLimit(`${clientIp(req)}:${email}`, {
    prefix: "pwreset-confirm",
    max: 10,
    window: "1 h",
  });
  if (!rate.success) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  await connectDB();
  const user = await UserModel.findOne({ email });
  if (
    !user?.passwordResetTokenHash ||
    !user.passwordResetExpiresAt ||
    user.passwordResetExpiresAt.getTime() < Date.now()
  ) {
    return NextResponse.json({ error: "invalid_or_expired_token" }, { status: 400 });
  }

  const valid = await bcrypt.compare(token, user.passwordResetTokenHash);
  if (!valid) {
    return NextResponse.json({ error: "invalid_or_expired_token" }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await UserModel.findByIdAndUpdate(user._id, {
    $set: { passwordHash },
    $unset: { passwordResetTokenHash: "", passwordResetExpiresAt: "" },
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
