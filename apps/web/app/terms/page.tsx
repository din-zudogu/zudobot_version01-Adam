import Link from "next/link";
import { ZudobotLogo } from "@/components/layout/ZudobotLogo";

export const metadata = {
  title: "ข้อตกลงการใช้งาน — Zudobot",
  description: "ข้อตกลงการใช้งานบริการ Zudobot by Zudogu",
};

const SECTIONS = [
  {
    title: "1. การยอมรับข้อตกลง",
    content: `การสมัครหรือใช้บริการ Zudobot ("บริการ") ถือว่าคุณยอมรับข้อตกลงการใช้งานฉบับนี้ทั้งหมด หากคุณไม่ยอมรับ กรุณาหยุดใช้บริการทันที\n\nบริการนี้ให้โดย Zudogu ("บริษัท") โดยผู้ใช้ต้องมีอายุ 18 ปีขึ้นไปหรือได้รับความยินยอมจากผู้ปกครอง`,
  },
  {
    title: "2. คำอธิบายบริการ",
    content: `Zudobot เป็น AI Sales Agent สำหรับธุรกิจไทย ที่ช่วยตอบลูกค้าอัตโนมัติผ่าน Widget บนเว็บไซต์ของคุณ ขับเคลื่อนด้วย Google Gemini AI\n\nบริการประกอบด้วย:\n• Widget แชทที่ติดตั้งบนเว็บไซต์ของคุณ\n• Dashboard จัดการบอทและดูสถิติ\n• AI ที่เรียนรู้ข้อมูลธุรกิจของคุณ\n• ระบบ Memory สำหรับจดจำลูกค้า`,
  },
  {
    title: "3. Trial ฟรี 14 วัน",
    content: `เมื่อสมัครใหม่ คุณจะได้รับสิทธิ์ทดลองใช้ฟรี 14 วัน โดย:\n\n• ไม่ต้องผูกบัตรเครดิต\n• จำกัด 250 ข้อความ/วัน\n• Memory 1 MB\n• Retention 7 วัน\n• 1 ช่องทาง Widget\n\nเมื่อ Trial หมดอายุ บัญชีจะถูก Suspend จนกว่าจะเลือก Plan ที่ต้องการชำระเงิน`,
  },
  {
    title: "4. การชำระเงินและการยกเลิก",
    content: `ราคาและ Plan ต่างๆ ดูได้ที่หน้า /pricing\n\n• ชำระรายเดือนหรือรายปี ราคารวม VAT 7%\n• สามารถยกเลิกได้ตลอดเวลา โดยบริการจะยังใช้ได้จนสิ้นสุดรอบที่ชำระแล้ว\n• ไม่มีการคืนเงินสำหรับรอบที่ชำระแล้วบางส่วน\n• บริษัทขอสงวนสิทธิ์ปรับราคาโดยแจ้งล่วงหน้า 30 วัน`,
  },
  {
    title: "5. การใช้งานที่ยอมรับได้",
    content: `คุณตกลงที่จะ:\n\n• ใช้บริการเพื่อวัตถุประสงค์ทางธุรกิจที่ถูกกฎหมายเท่านั้น\n• ไม่ใช้ Zudobot ในทางที่ทำให้เกิดความเสียหาย หลอกลวง หรือผิดกฎหมาย\n• ไม่พยายาม Reverse Engineer หรือเจาะระบบ\n• ปฏิบัติตาม PDPA ในการเก็บข้อมูลลูกค้าของคุณเองที่ผ่าน Widget\n• แจ้งลูกค้าของคุณว่ากำลังคุยกับ AI Agent`,
  },
  {
    title: "6. ทรัพย์สินทางปัญญา",
    content: `• โค้ด, ออกแบบ, แบรนด์ Zudobot เป็นทรัพย์สินของบริษัท\n• ข้อมูลธุรกิจและบทสนทนาที่คุณสร้างยังคงเป็นของคุณ\n• คุณให้สิทธิ์บริษัทใช้ข้อมูลดังกล่าวเพื่อให้บริการและปรับปรุงระบบ AI เท่านั้น`,
  },
  {
    title: "7. ข้อจำกัดความรับผิด",
    content: `บริการนี้ให้ "ตามสภาพที่เป็น" (as-is) บริษัทไม่รับประกันว่า:\n\n• AI จะตอบถูกต้อง 100%\n• บริการจะไม่มีการหยุดชะงัก\n\nบริษัทไม่รับผิดชอบต่อความเสียหายทางอ้อม ความสูญเสียทางธุรกิจ หรือความเสียหายที่เกิดจากการตอบของ AI ในทุกกรณี\n\nความรับผิดสูงสุดของบริษัทจำกัดไม่เกินค่าบริการที่คุณชำระในรอบ 3 เดือนก่อนหน้า`,
  },
  {
    title: "8. การระงับและยุติบัญชี",
    content: `บริษัทขอสงวนสิทธิ์ระงับหรือยุติบัญชีโดยทันทีหากพบว่า:\n\n• ละเมิดข้อตกลงการใช้งานฉบับนี้\n• ใช้บริการในทางที่ผิดกฎหมาย\n• ไม่ชำระค่าบริการตามกำหนด\n\nในกรณีการยุติบัญชีตามคำร้องของคุณ ข้อมูลจะถูกลบภายใน 90 วัน`,
  },
  {
    title: "9. กฎหมายที่ใช้บังคับ",
    content: `ข้อตกลงนี้อยู่ภายใต้บังคับของกฎหมายไทย ข้อพิพาทที่เกิดขึ้นให้ใช้ศาลไทยเป็นเขตอำนาจศาล\n\nปรับปรุงล่าสุด: พฤษภาคม 2569`,
  },
];

export default function TermsPage() {
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
            ข้อตกลงการใช้งาน
          </h1>
          <p className="text-sm text-text-muted mb-8">
            Terms of Service — Zudobot by Zudogu
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
              href="/privacy"
              className="text-sm text-brand-600 hover:underline"
            >
              นโยบายความเป็นส่วนตัว →
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
