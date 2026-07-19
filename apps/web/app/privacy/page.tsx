import Link from "next/link";
import { ZudobotLogo } from "@/components/layout/ZudobotLogo";

export const metadata = {
  title: "นโยบายความเป็นส่วนตัว — Zudobot",
  description: "นโยบายความเป็นส่วนตัวและการคุ้มครองข้อมูลส่วนบุคคล (PDPA) ของ Zudobot by Zudogu",
};

const SECTIONS = [
  {
    title: "1. ผู้ควบคุมข้อมูลส่วนบุคคล",
    content: `บริษัท Zudogu ("บริษัท", "เรา") เป็นผู้ให้บริการ Zudobot ซึ่งเป็นผู้ควบคุมข้อมูลส่วนบุคคลตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA)\n\nช่องทางติดต่อ: zudogu.official@gmail.com`,
  },
  {
    title: "2. ข้อมูลที่เราเก็บรวบรวม",
    content: `เราเก็บรวบรวมข้อมูลต่อไปนี้เมื่อคุณสมัครและใช้บริการ:\n\n• ชื่อและอีเมล จาก Google Account ของคุณ\n• รูปโปรไฟล์ Google (ถ้ามี)\n• ข้อมูลธุรกิจที่คุณกรอกในขั้นตอน Onboarding (ชื่อธุรกิจ, ประเภทธุรกิจ, URL เว็บไซต์)\n• ข้อมูลการตั้งค่าบอท (ชื่อบอท, สไตล์การพูด, สีและตำแหน่ง Widget)\n• ประวัติการสนทนาระหว่างลูกค้าของคุณกับ Zudobot\n• ข้อมูลการใช้งานและ Log ของระบบ`,
  },
  {
    title: "3. วัตถุประสงค์การใช้ข้อมูล",
    content: `เราใช้ข้อมูลของคุณเพื่อ:\n\n• ให้บริการ Zudobot และบำรุงรักษาระบบ\n• ยืนยันตัวตนและจัดการบัญชีผู้ใช้\n• ปรับปรุงคุณภาพการตอบสนองของ AI Agent\n• ส่งการแจ้งเตือนเกี่ยวกับบัญชีและบริการ\n• ปฏิบัติตามกฎหมายและข้อบังคับที่เกี่ยวข้อง\n\nเราไม่ขาย ไม่แบ่งปัน หรือเผยแพร่ข้อมูลส่วนบุคคลของคุณให้บุคคลที่สามเพื่อวัตถุประสงค์ทางการตลาด`,
  },
  {
    title: "4. ระยะเวลาการเก็บรักษาข้อมูล",
    content: `เราเก็บข้อมูลของคุณตลอดอายุการใช้งานบัญชี และจะลบข้อมูลภายใน 90 วันหลังจากที่คุณยกเลิกบัญชีหรือร้องขอให้ลบข้อมูล\n\nข้อมูล Log ของระบบจะถูกเก็บไว้ไม่เกิน 30 วันเพื่อวัตถุประสงค์ด้านความปลอดภัย`,
  },
  {
    title: "5. การเปิดเผยข้อมูลแก่บุคคลที่สาม",
    content: `เราอาจเปิดเผยข้อมูลของคุณให้แก่:\n\n• Google LLC — ผู้ให้บริการ OAuth Authentication\n• Google Cloud (Gemini AI) — ผู้ให้บริการ AI ที่ประมวลผลข้อความบทสนทนา\n• ผู้ให้บริการ Cloud Infrastructure ที่ใช้โฮสต์ระบบ\n\nผู้ให้บริการเหล่านี้ผูกพันตามสัญญาให้ปกป้องข้อมูลของคุณตามมาตรฐานที่เหมาะสม`,
  },
  {
    title: "6. สิทธิ์ของเจ้าของข้อมูล",
    content: `ในฐานะเจ้าของข้อมูล คุณมีสิทธิ์:\n\n• สิทธิ์เข้าถึง — ขอสำเนาข้อมูลที่เราเก็บเกี่ยวกับคุณ\n• สิทธิ์แก้ไข — ขอแก้ไขข้อมูลที่ไม่ถูกต้อง\n• สิทธิ์ลบ — ขอให้ลบข้อมูลส่วนบุคคลของคุณ\n• สิทธิ์คัดค้าน — คัดค้านการประมวลผลข้อมูลในบางกรณี\n• สิทธิ์การโอนย้ายข้อมูล — ขอรับข้อมูลในรูปแบบที่สามารถนำไปใช้ต่อได้\n• สิทธิ์ถอนความยินยอม — ถอนความยินยอมได้ตลอดเวลา โดยไม่กระทบต่อความชอบด้วยกฎหมายของการประมวลผลก่อนการถอนความยินยอม\n\nส่งคำร้องได้ที่: zudogu.official@gmail.com`,
  },
  {
    title: "7. ความปลอดภัยของข้อมูล",
    content: `เราใช้มาตรการรักษาความปลอดภัยที่เหมาะสม ได้แก่:\n\n• การเข้ารหัส HTTPS ตลอดการส่งข้อมูล\n• การยืนยันตัวตนผ่าน Google OAuth 2.0\n• การจำกัดสิทธิ์การเข้าถึงข้อมูลตามหน้าที่\n• การสำรองข้อมูลและตรวจสอบระบบสม่ำเสมอ`,
  },
  {
    title: "8. การเปลี่ยนแปลงนโยบาย",
    content: `เราอาจปรับปรุงนโยบายนี้เป็นครั้งคราว โดยจะแจ้งให้คุณทราบผ่านอีเมลหรือประกาศบนระบบล่วงหน้าอย่างน้อย 30 วัน\n\nการใช้บริการต่อเนื่องหลังจากวันที่นโยบายมีผลบังคับใช้ถือว่าคุณยอมรับนโยบายที่ปรับปรุงแล้ว\n\nปรับปรุงล่าสุด: พฤษภาคม 2569`,
  },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-surface-secondary px-4 py-12">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-center mb-8">
          <Link href="/">
            <ZudobotLogo size="md" variant="color" />
          </Link>
        </div>

        <div className="card-premium p-8">
          <h1 className="font-heading text-2xl font-bold text-text-primary mb-1">
            นโยบายความเป็นส่วนตัว
          </h1>
          <p className="text-sm text-text-muted mb-8">
            ฉบับภาษาไทย — เป็นไปตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA)
          </p>

          <div className="space-y-8">
            {SECTIONS.map((s) => (
              <section key={s.title}>
                <h2 className="font-heading text-base font-semibold text-text-primary mb-3">
                  {s.title}
                </h2>
                <div className="text-sm text-text-secondary leading-relaxed whitespace-pre-line">
                  {s.content}
                </div>
              </section>
            ))}
          </div>

          <div className="mt-10 pt-6 border-t border-border-default flex items-center justify-between">
            <Link
              href="/terms"
              className="text-sm text-brand-600 hover:underline"
            >
              ข้อตกลงการใช้งาน →
            </Link>
            <Link
              href="/"
              className="text-sm text-text-muted hover:text-text-primary transition-colors"
            >
              ← กลับหน้าหลัก
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
