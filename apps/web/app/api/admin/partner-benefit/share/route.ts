import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { sendEmail } from "@/lib/email/resend";
import { AMPLIFY_CONFIG } from "@/lib/env/amplifyGuardrail";

const PAGE_URL = "https://zudobot.zudogu.com/partner-benefit";

export async function POST(req: NextRequest) {
  const token = await getToken({ req, secret: AMPLIFY_CONFIG.authSecret, secureCookie: true });
  if (!token || (token.role !== "super_admin" && token.role !== "admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: { emails: string[] };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  const emails = (body.emails ?? []).map((e) => e.trim()).filter(Boolean);
  if (emails.length === 0) {
    return NextResponse.json({ error: "no_emails" }, { status: 400 });
  }
  if (emails.length > 50) {
    return NextResponse.json({ error: "too_many" }, { status: 400 });
  }

  const html = `
<!DOCTYPE html>
<html lang="th">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:40px 0">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0"
        style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)">
        <tr>
          <td style="background:linear-gradient(135deg,#0D1829,#1E5BC6);padding:32px 40px;text-align:center">
            <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:800">ZUDOBOT</h1>
            <p style="margin:6px 0 0;color:#a8c4f0;font-size:13px;letter-spacing:1px">PARTNER PROGRAM 2025</p>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 40px">
            <p style="margin:0 0 16px;font-size:16px;color:#1a2332">สวัสดีครับ/ค่ะ,</p>
            <p style="margin:0 0 24px;font-size:15px;color:#4a5568;line-height:1.7">
              ทีม Zudobot ขอเชิญคุณร่วมเป็น <strong>Partner</strong> กับโปรแกรมสุดพิเศษของเรา<br>
              กำไร <strong style="color:#D97706">45% ทุกเดือน</strong> จากลูกค้าทุกราย โดยไม่ต้องพัฒนา AI เอง
            </p>
            <table width="100%" cellpadding="0" cellspacing="0"
              style="background:#f0f5ff;border:1px solid #c7d8f8;border-radius:10px;margin:0 0 28px">
              <tr>
                <td style="padding:18px 22px">
                  <p style="margin:0 0 8px;font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px">สิ่งที่คุณจะได้รับ</p>
                  <p style="margin:0 0 5px;font-size:14px;color:#1a2332">✓ &nbsp;Recurring Revenue 45% ทุกเดือน</p>
                  <p style="margin:0 0 5px;font-size:14px;color:#1a2332">✓ &nbsp;รายได้สูงสุด ฿6,745/เดือน/ลูกค้า</p>
                  <p style="margin:0 0 5px;font-size:14px;color:#1a2332">✓ &nbsp;ฟรีค่าสมัคร ไม่มีค่า Setup</p>
                  <p style="margin:0;font-size:14px;color:#1a2332">✓ &nbsp;รับเงินอัตโนมัติผ่าน Stripe</p>
                </td>
              </tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center">
                  <a href="${PAGE_URL}"
                    style="display:inline-block;background:#1E5BC6;color:#ffffff;font-size:15px;font-weight:600;
                           text-decoration:none;padding:14px 44px;border-radius:10px">
                    ดูข้อมูล Partner Program →
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;text-align:center">
              หรือคัดลอก URL: <span style="color:#1E5BC6">${PAGE_URL}</span>
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#f8faff;border-top:1px solid #e5eaf5;padding:20px 40px;text-align:center">
            <p style="margin:0;font-size:12px;color:#9ca3af">© 2025 Zudogu Co., Ltd. • Zudobot Partner Program</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const results = await Promise.allSettled(
    emails.map((to) =>
      sendEmail(to, "คำเชิญเข้าร่วม Zudobot Partner Program 2025", html)
    )
  );

  const failed = results
    .map((r, i) => (r.status === "rejected" ? emails[i] : null))
    .filter(Boolean);

  return NextResponse.json({ sent: emails.length - failed.length, failed });
}
