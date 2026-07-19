import { Resend } from "resend";

const FROM = process.env.EMAIL_FROM ?? "noreply@zudogu.com";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

export async function sendEmail(to: string, subject: string, html: string) {
  return getResend().emails.send({ from: FROM, to, subject, html });
}

export async function sendPartnerInviteEmail(opts: {
  to:          string;
  companyName: string;
  joinUrl:     string;
  expiresAt:   Date;
}) {
  const { to, companyName, joinUrl, expiresAt } = opts;
  const expireStr = expiresAt.toLocaleDateString("th-TH", {
    year: "numeric", month: "long", day: "numeric",
  });
  const html = `
<!DOCTYPE html>
<html lang="th">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:40px 0">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)">

        <!-- Header -->
        <tr>
          <td style="background:#1E5BC6;padding:28px 40px;text-align:center">
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.3px">ZUDOBOT</h1>
            <p style="margin:6px 0 0;color:#a8c4f0;font-size:13px">Partner Program</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px">
            <p style="margin:0 0 16px;font-size:16px;color:#1a2332">
              สวัสดีทีม <strong>${companyName}</strong>,
            </p>
            <p style="margin:0 0 24px;font-size:15px;color:#4a5568;line-height:1.7">
              ยินดีต้อนรับเข้าสู่ <strong>Zudobot Partner Program</strong>!<br>
              คุณได้รับคำเชิญให้เป็นพาร์ทเนอร์ของ Zudobot — แพลตฟอร์ม AI Chatbot สำหรับร้านค้าออนไลน์
            </p>

            <!-- Info box -->
            <table width="100%" cellpadding="0" cellspacing="0"
              style="background:#f0f5ff;border:1px solid #c7d8f8;border-radius:10px;margin:0 0 28px">
              <tr>
                <td style="padding:18px 22px">
                  <p style="margin:0 0 10px;font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px">สิ่งที่คุณจะได้รับ</p>
                  <p style="margin:0 0 6px;font-size:14px;color:#1a2332">✓ &nbsp;รายได้จากการแนะนำลูกค้า (Revenue Share)</p>
                  <p style="margin:0 0 6px;font-size:14px;color:#1a2332">✓ &nbsp;Dashboard ติดตามลูกค้าและรายได้แบบ Real-time</p>
                  <p style="margin:0 0 6px;font-size:14px;color:#1a2332">✓ &nbsp;รับเงินผ่าน Stripe Connect โดยตรง</p>
                  <p style="margin:0;font-size:13px;color:#e55f00;margin-top:10px;font-weight:600">
                    ⏰ ลิงก์นี้หมดอายุวันที่ ${expireStr}
                  </p>
                </td>
              </tr>
            </table>

            <!-- CTA button -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center">
                  <a href="${joinUrl}"
                    style="display:inline-block;background:#1E5BC6;color:#ffffff;font-size:15px;font-weight:600;
                           text-decoration:none;padding:14px 44px;border-radius:10px;letter-spacing:0.2px">
                    เริ่มต้นเป็น Partner →
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;text-align:center;line-height:1.6">
              หากลิงก์ด้านบนใช้ไม่ได้ ให้คัดลอก URL นี้ไปวางในเบราว์เซอร์:<br>
              <span style="color:#1E5BC6;word-break:break-all">${joinUrl}</span>
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8faff;border-top:1px solid #e5eaf5;padding:20px 40px;text-align:center">
            <p style="margin:0;font-size:12px;color:#9ca3af">
              © 2025 Zudogu Co., Ltd. • อีเมลนี้ส่งโดยทีม Zudobot Partner Program
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return getResend().emails.send({
    from:    FROM,
    to,
    subject: `คำเชิญเข้าร่วม Zudobot Partner Program — ${companyName}`,
    html,
  });
}

export async function sendPartnerConsolidatedInvoiceEmail(opts: {
  to:           string;
  companyName:  string;
  invoiceNumber:string;
  billingMonth: number;
  billingYear:  number;
  lineItems:    { businessName: string; planId: string; partnerCostThb: number }[];
  subtotalThb:  number;
  vatThb:       number;
  totalThb:     number;
  dueDate:      Date;
  paymentUrl:   string;
}) {
  const { to, companyName, invoiceNumber, billingMonth, billingYear, lineItems, subtotalThb, vatThb, totalThb, dueDate, paymentUrl } = opts;

  const monthNames = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
  const periodLabel = `${monthNames[billingMonth - 1]} ${billingYear + 543}`;
  const dueStr = dueDate.toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" });
  const thb = (n: number) => `฿${n.toLocaleString("th-TH")}`;

  const lineItemRows = lineItems.map((item) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e5eaf5;font-size:13px;color:#374151">${item.businessName}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5eaf5;font-size:13px;color:#374151;text-transform:capitalize">${item.planId}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5eaf5;font-size:13px;color:#374151;text-align:right">${thb(item.partnerCostThb)}</td>
    </tr>`).join("");

  const html = `<!DOCTYPE html>
<html lang="th">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:40px 0">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)">
        <tr><td style="background:#1E5BC6;padding:28px 40px;text-align:center">
          <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700">ZUDOBOT</h1>
          <p style="margin:6px 0 0;color:#a8c4f0;font-size:13px">Partner Consolidated Invoice</p>
        </td></tr>
        <tr><td style="padding:36px 40px">
          <p style="margin:0 0 4px;font-size:16px;color:#1a2332">สวัสดีทีม <strong>${companyName}</strong>,</p>
          <p style="margin:0 0 24px;font-size:14px;color:#4a5568">ใบแจ้งหนี้รวมประจำเดือน <strong>${periodLabel}</strong> (เลขที่ ${invoiceNumber})</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5eaf5;border-radius:10px;overflow:hidden;margin-bottom:24px">
            <thead>
              <tr style="background:#f8faff">
                <th style="padding:10px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600">ลูกค้า</th>
                <th style="padding:10px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600">แผน</th>
                <th style="padding:10px 12px;text-align:right;font-size:12px;color:#6b7280;font-weight:600">ราคาทุน</th>
              </tr>
            </thead>
            <tbody>${lineItemRows}</tbody>
          </table>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px">
            <tr><td style="padding:4px 0;font-size:13px;color:#6b7280">ราคาก่อน VAT</td><td style="text-align:right;font-size:13px;color:#374151">${thb(subtotalThb)}</td></tr>
            <tr><td style="padding:4px 0;font-size:13px;color:#6b7280">VAT 7%</td><td style="text-align:right;font-size:13px;color:#374151">${thb(vatThb)}</td></tr>
            <tr><td style="padding:8px 0 4px;font-size:16px;font-weight:700;color:#1a2332;border-top:2px solid #e5eaf5">ยอดรวมทั้งหมด</td><td style="text-align:right;font-size:16px;font-weight:700;color:#1E5BC6;border-top:2px solid #e5eaf5">${thb(totalThb)}</td></tr>
          </table>
          <p style="margin:0 0 20px;font-size:13px;color:#e55f00;font-weight:600">⏰ กรุณาชำระภายในวันที่ ${dueStr}</p>
          <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
            <a href="${paymentUrl}" style="display:inline-block;background:#1E5BC6;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 44px;border-radius:10px">
              ชำระเงินออนไลน์ →
            </a>
          </td></tr></table>
        </td></tr>
        <tr><td style="background:#f8faff;border-top:1px solid #e5eaf5;padding:20px 40px;text-align:center">
          <p style="margin:0;font-size:12px;color:#9ca3af">© 2025 Zudogu Co., Ltd. • Zudobot Partner Program</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return getResend().emails.send({
    from:    FROM,
    to,
    subject: `ใบแจ้งหนี้รวม ${periodLabel} — ${companyName} (${invoiceNumber})`,
    html,
  });
}

export function promptPayRenewalHtml(opts: {
  name:       string;
  planLabel:  string;
  totalThb:   number;
  expiresAt:  Date;
  daysLeft:   number;
  renewUrl:   string;
}): string {
  const { name, planLabel, totalThb, expiresAt, daysLeft, renewUrl } = opts;
  const expireStr = expiresAt.toLocaleDateString("th-TH", {
    year: "numeric", month: "long", day: "numeric",
  });

  return `
<!DOCTYPE html>
<html lang="th">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fb;padding:40px 0">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08)">

        <!-- Header -->
        <tr>
          <td style="background:#1E5BC6;padding:28px 40px;text-align:center">
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.3px">
              ZUDOBOT
            </h1>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px">
            <p style="margin:0 0 16px;font-size:16px;color:#1a2332">สวัสดีคุณ <strong>${name}</strong>,</p>
            <p style="margin:0 0 24px;font-size:15px;color:#4a5568;line-height:1.6">
              แพ็กเกจ <strong>${planLabel}</strong> ของคุณจะ<strong>หมดอายุใน ${daysLeft} วัน</strong>
              (${expireStr}) กรุณาต่ออายุเพื่อให้บอทของคุณทำงานต่อเนื่อง
            </p>

            <!-- Plan summary box -->
            <table width="100%" cellpadding="0" cellspacing="0"
              style="background:#f0f5ff;border:1px solid #c7d8f8;border-radius:10px;margin:0 0 28px">
              <tr>
                <td style="padding:18px 22px">
                  <p style="margin:0 0 6px;font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px">แพ็กเกจปัจจุบัน</p>
                  <p style="margin:0 0 2px;font-size:17px;font-weight:700;color:#1a2332">${planLabel}</p>
                  <p style="margin:0;font-size:14px;color:#4a5568">฿${totalThb.toLocaleString("th-TH")} / เดือน (รวม VAT)</p>
                </td>
              </tr>
            </table>

            <!-- CTA button -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center">
                  <a href="${renewUrl}"
                    style="display:inline-block;background:#1E5BC6;color:#ffffff;font-size:15px;font-weight:600;
                           text-decoration:none;padding:14px 40px;border-radius:10px;letter-spacing:0.2px">
                    ต่ออายุแพ็กเกจ →
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:24px 0 0;font-size:13px;color:#9ca3af;text-align:center;line-height:1.6">
              PromptPay ไม่ต่ออายุอัตโนมัติ — กรุณาชำระก่อนวันที่ ${expireStr}<br>
              หากต้องการต่ออายุอัตโนมัติ ลองเปลี่ยนเป็นบัตรเครดิต/เดบิต
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8faff;border-top:1px solid #e5eaf5;padding:20px 40px;text-align:center">
            <p style="margin:0;font-size:12px;color:#9ca3af">
              © 2025 Zudogu Co., Ltd. • ส่งโดยอัตโนมัติจาก Zudobot Billing System
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
