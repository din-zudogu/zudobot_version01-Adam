/** NextAuth `?error=` codes → user-facing Thai messages */
export function getAuthErrorMessage(code: string | null): string | null {
  if (!code) return null;
  switch (code) {
    case "AccessDenied":
      return "ไม่สามารถเข้าสู่ระบบได้ — ระบบฐานข้อมูลอาจไม่พร้อม หรือบัญชีถูกปิดใช้งาน กรุณาลองใหม่ในอีกสักครู่";
    case "Configuration":
      return "การตั้งค่า Google Login บนเซิร์ฟเวอร์ไม่ครบ — ติดต่อผู้ดูแลระบบ";
    case "OAuthSignin":
    case "OAuthCallback":
      return "เกิดข้อผิดพลาดระหว่างยืนยันตัวตนกับ Google กรุณาลองใหม่";
    case "OAuthAccountNotLinked":
      return "อีเมลนี้เคยใช้วิธีเข้าสู่ระบบอื่น — กรุณาใช้ Google บัญชีเดิม";
    case "CallbackRouteError":
      return "เกิดข้อผิดพลาดหลังล็อกอิน กรุณาลองใหม่อีกครั้ง";
    case "CredentialsSignin":
    case "wrong_password":
    case "no_password_set":
      return "อีเมลหรือรหัสผ่านไม่ถูกต้อง หรือบัญชีนี้ยังไม่ได้ตั้งรหัสผ่าน — ลองเข้าสู่ระบบด้วย Google หรือกด \"ลืมรหัสผ่าน\"";
    default:
      return `เข้าสู่ระบบไม่สำเร็จ (${code}) กรุณาลองใหม่`;
  }
}
