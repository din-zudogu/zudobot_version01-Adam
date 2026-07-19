import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db/connect";
import { UserModel } from "@/lib/db/models/User";
import { enforceRateLimit, clientIp } from "@/lib/security/rateLimit";
import { sendEmail } from "@/lib/email/resend";
import { AMPLIFY_CONFIG } from "@/lib/env/amplifyGuardrail";

const GENERIC_RESPONSE = { ok: true, message: "หากอีเมลนี้มีอยู่ในระบบ เราได้ส่งลิงก์ตั้งรหัสผ่านใหม่ไปให้แล้ว" };

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = (body?.email as string | undefined)?.toLowerCase().trim();
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }

  const rate = await enforceRateLimit(`${clientIp(req)}:${email}`, {
    prefix: "pwreset",
    max: 5,
    window: "1 h",
  });
  if (!rate.success) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  try {
    await connectDB();
    // Only ever issue a reset for an account that already exists via Google —
    // never a signal for account existence either way (generic response always).
    const user = await UserModel.findOne({ email, googleId: { $exists: true, $ne: null } });
    if (user) {
      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = await bcrypt.hash(rawToken, 12);
      await UserModel.findByIdAndUpdate(user._id, {
        passwordResetTokenHash: tokenHash,
        passwordResetExpiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      });

      const resetUrl = `${AMPLIFY_CONFIG.authUrl}/reset-password?token=${rawToken}&email=${encodeURIComponent(email)}`;
      const html = `
<!DOCTYPE html>
<html lang="th">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:40px 0">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)">
        <tr><td style="background:#1E5BC6;padding:28px 40px;text-align:center">
          <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700">ZUDOBOT</h1>
        </td></tr>
        <tr><td style="padding:36px 40px">
          <p style="margin:0 0 16px;font-size:16px;color:#1a2332">สวัสดี,</p>
          <p style="margin:0 0 24px;font-size:15px;color:#4a5568;line-height:1.7">
            มีคำขอตั้งรหัสผ่านใหม่สำหรับบัญชี <strong>${email}</strong> ลิงก์นี้จะหมดอายุภายใน 1 ชั่วโมง
          </p>
          <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
            <a href="${resetUrl}" style="display:inline-block;background:#1E5BC6;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 44px;border-radius:10px">
              ตั้งรหัสผ่านใหม่ →
            </a>
          </td></tr></table>
          <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;text-align:center">
            หากคุณไม่ได้ร้องขอ กรุณาเพิกเฉยต่ออีเมลนี้
          </p>
        </td></tr>
        <tr><td style="background:#f8faff;border-top:1px solid #e5eaf5;padding:20px 40px;text-align:center">
          <p style="margin:0;font-size:12px;color:#9ca3af">© 2025 Zudogu Co., Ltd.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
      await sendEmail(email, "ตั้งรหัสผ่านใหม่ — ZUDOBOT", html);
    }
  } catch (err) {
    console.error("[forgot-password]", err instanceof Error ? err.message : err);
    // fall through — still return the generic response
  }

  return NextResponse.json(GENERIC_RESPONSE, { status: 200 });
}
