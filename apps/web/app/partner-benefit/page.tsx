import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/Button";
import { getPublicPricingData } from "@/lib/data/getPublicPricing";
import { PartnerBenefitPricingDynamic } from "@/components/partner-benefit/PartnerBenefitPricingDynamic";

export const metadata: Metadata = {
  title: "Partner Benefit — Zudobot",
  description:
    "เพิ่ม Recurring Revenue ให้ธุรกิจซอฟต์แวร์และ Freelancer ด้วย Zudobot Partner Program — AI Chatbot สำหรับร้านค้าออนไลน์",
  openGraph: {
    title: "Zudobot Partner Benefit",
    description: "กำไร 45% ทุกเดือน จากลูกค้าทุกราย — เริ่มต้นฟรี ไม่มีค่า Setup",
    url: "https://zudobot.zudogu.com/partner-benefit",
  },
};

/* ─── Data ─────────────────────────────────────────── */
const marketStats = [
  {
    value: "$15.5B",
    label: "มูลค่าตลาด AI Chatbot โลก ปี 2023",
    detail: "คาดเติบโตเป็น $66.6B ภายในปี 2028 (CAGR 34.8%)",
    source: "MarketsandMarkets, 2023",
    color: "blue",
  },
  {
    value: "67%",
    label: "ผู้บริโภคทั่วโลกเคยใช้ Chatbot ในปี 2024",
    detail: "และ 87.2% มีประสบการณ์กลาง-บวกกับ Chatbot",
    source: "Tidio Customer Service Report, 2024",
    color: "gold",
  },
  {
    value: "80%",
    label: "ของธุรกิจวางแผนใช้ Chatbot ภายในปี 2025",
    detail: "ตลาดไทย e-commerce เติบโต ฿900B+ ต่อปี",
    source: "Outgrow, 2024 / ETDA Thailand 2023",
    color: "blue",
  },
  {
    value: "+35%",
    label: "Conversion Rate เพิ่มเมื่อมี Chatbot บนเว็บ",
    detail: "โดยเฉพาะในขั้นตอนตัดสินใจซื้อของลูกค้า",
    source: "Drift/HubSpot Conversational Marketing, 2023",
    color: "gold",
  },
  {
    value: "30%",
    label: "ลดต้นทุน Customer Support ด้วย Chatbot",
    detail: "แทนที่คำถามซ้ำๆ โดยไม่ต้องเพิ่มพนักงาน",
    source: "IBM Watson, 2024",
    color: "blue",
  },
  {
    value: "2.5B",
    label: "ชั่วโมงงานที่ Chatbot ช่วยประหยัดต่อปี",
    detail: "ทั่วทุกอุตสาหกรรม — ประหยัดต้นทุนได้จริง",
    source: "Juniper Research, 2023",
    color: "gold",
  },
];

const customerBenefits = [
  {
    icon: "⚡",
    title: "ตอบคำถามทันที ไม่ต้องรอ",
    desc: "ลูกค้าออนไลน์ 53% ละทิ้งการซื้อหากต้องรอตอบนานกว่า 3 นาที Zudobot ตอบได้ใน <1 วินาที ตลอด 24 ชั่วโมง",
    source: "Forrester Research — Time is Money, 2023",
  },
  {
    icon: "📈",
    title: "เพิ่ม Conversion Rate 20–45%",
    desc: "การมี Live Chat / Chatbot บนเว็บเพิ่ม Conversion ได้ 20–45% โดยเฉพาะในช่วงที่ลูกค้ากำลังตัดสินใจซื้อ",
    source: "Intercom Customer Engagement Report, 2023",
  },
  {
    icon: "🛒",
    title: "ลด Cart Abandonment 20–30%",
    desc: "Cart Abandonment เฉลี่ย 69.8% — ส่วนใหญ่เกิดจากคำถามที่ไม่ได้รับคำตอบ Chatbot แก้ปัญหานี้ได้ทันที",
    source: "Baymard Institute, 2024 / Tidio, 2023",
  },
  {
    icon: "🔁",
    title: "เพิ่มอัตราลูกค้าซื้อซ้ำ",
    desc: "ลูกค้าที่ได้รับประสบการณ์ที่ดีมีแนวโน้มซื้อซ้ำ 5 เท่า Chatbot ช่วยให้ประสบการณ์สม่ำเสมอทุก Session",
    source: "Bain & Company Customer Experience Research, 2022",
  },
  {
    icon: "⭐",
    title: "เพิ่ม CSAT Score 12%",
    desc: "ธุรกิจที่ใช้ AI Chatbot มี Customer Satisfaction Score สูงกว่าค่าเฉลี่ยอุตสาหกรรม โดยเฉพาะด้านความรวดเร็ว",
    source: "Zendesk Customer Experience Trends, 2024",
  },
  {
    icon: "💬",
    title: "จัดการ 80% ของคำถามอัตโนมัติ",
    desc: "Chatbot จัดการคำถามทั่วไปได้ถึง 80% โดยไม่ต้องมีพนักงาน ลดภาระทีม Support อย่างมีนัยสำคัญ",
    source: "IBM Global AI Report, 2024",
  },
];

const partnerBenefits = [
  {
    icon: "💰",
    title: "Recurring Revenue ทุกเดือน",
    desc: "ทุกครั้งที่ลูกค้าจ่ายค่าบริการ คุณได้รับส่วนต่างกำไรอัตโนมัติผ่าน Stripe Connect — ไม่ต้องรอ ไม่ต้องออกใบแจ้งหนี้",
    highlight: "฿445–฿6,745/เดือน/ลูกค้า",
    color: "brand",
  },
  {
    icon: "🚀",
    title: "เพิ่มมูลค่า Project ของคุณ",
    desc: "เพิ่ม AI Chatbot เป็น Feature ใน Package การทำเว็บ เสนอราคาได้สูงขึ้น สร้างความแตกต่างจากคู่แข่ง",
    highlight: "Website + AI = Premium Package",
    color: "gold",
  },
  {
    icon: "📊",
    title: "Dashboard ติดตามรายได้ Real-time",
    desc: "Partner Dashboard แสดงข้อมูลทั้งหมด: จำนวนลูกค้า, รายได้สะสม, สถานะ Subscription และประวัติการโอนเงิน",
    highlight: "Real-time Dashboard",
    color: "brand",
  },
  {
    icon: "🔧",
    title: "ไม่ต้องพัฒนา AI เอง",
    desc: "ประหยัดเวลาพัฒนาหลายเดือน ใช้ Zudobot เป็น Solution พร้อมใช้ — Infrastructure, AI Model, Scaling ดูแลให้ทั้งหมด",
    highlight: "Zero DevOps ภาระ",
    color: "gold",
  },
  {
    icon: "🎯",
    title: "ลูกค้า Stickier ขึ้น",
    desc: "เมื่อลูกค้าติดตั้ง Chatbot และเทรนด้วยข้อมูลของตัวเองแล้ว โอกาสเปลี่ยน Developer ลดลงมาก — รักษาความสัมพันธ์ได้ยาวขึ้น",
    highlight: "ลด Churn ของลูกค้าคุณ",
    color: "brand",
  },
  {
    icon: "📞",
    title: "Support จากทีม Zudobot โดยตรง",
    desc: "พาร์ทเนอร์ทุกรายได้รับการ Support ทั้งด้านเทคนิคและการขาย ไม่ต้องรับมือลูกค้าคนเดียว",
    highlight: "Dedicated Support",
    color: "gold",
  },
];

const steps = [
  {
    num: "1",
    title: "สมัครเป็น Partner",
    desc: "รับ Invitation Link จากทีม Zudobot สร้างบัญชีผ่าน Google Login และเชื่อมต่อ Stripe เพื่อรับเงิน",
    note: "⏱ ใช้เวลาไม่ถึง 10 นาที",
    bg: "from-brand-50 to-surface-secondary",
    border: "border-brand-100",
  },
  {
    num: "2",
    title: "เชิญลูกค้าสมัครใช้งาน",
    desc: "ใช้ Partner Link พิเศษเชิญลูกค้า ลูกค้าเลือกแพ็กเกจและชำระเงิน ระบบเชื่อมโยงกับบัญชี Partner คุณ",
    note: "🔗 Auto-tracking ทุก Referral",
    bg: "from-gold-50 to-surface-secondary",
    border: "border-gold-200",
  },
  {
    num: "3",
    title: "รับเงินอัตโนมัติ",
    desc: "ทุกเดือนที่ลูกค้าจ่ายค่าบริการ Stripe โอนส่วนต่างเข้าบัญชีคุณทันที Dashboard แสดงยอดทั้งหมด",
    note: "💰 Passive Income จริง",
    bg: "from-brand-900 to-brand-800",
    border: "border-brand-700",
    dark: true,
  },
];

const faqs = [
  {
    q: "ต้องมีความรู้ AI ไหม?",
    a: "ไม่ต้องเลย Zudobot จัดการทุกอย่างให้ คุณแค่ติดตั้งและแนะนำลูกค้าให้ Upload ข้อมูลสินค้า UI ใช้งานง่าย ลูกค้าทำเองได้โดยไม่ต้องพึ่ง Developer",
  },
  {
    q: "ถ้าลูกค้ายกเลิก Partner ได้เงินต่อไหม?",
    a: "ไม่ — รายได้จะหยุดเมื่อลูกค้าหยุดจ่าย แต่ Churn Rate ของ SaaS Chatbot เฉลี่ยต่ำกว่า 5% ต่อเดือน เพราะลูกค้าเทรน Bot ด้วยข้อมูลของตัวเองแล้ว",
  },
  {
    q: "ต้องดูแล Server หรือ AI Model เองไหม?",
    a: "ไม่ต้อง Zudobot ดูแล Infrastructure ทั้งหมด — Server, AI Model Update, Scaling คุณและลูกค้าไม่มีภาระเพิ่ม",
  },
  {
    q: "ลูกค้าต้องเทรน Bot ยากไหม?",
    a: "ง่ายมาก — Upload ไฟล์สินค้า, FAQ, หรือวางข้อความโดยตรง Bot เรียนรู้อัตโนมัติ ไม่ต้องเขียน Code หรือมีความรู้ IT",
  },
  {
    q: "รับเงินผ่านช่องทางไหน?",
    a: "ผ่าน Stripe Connect โอนตรงเข้าบัญชีธนาคารของคุณ (รองรับบัญชีไทย) ไม่มีขั้นตอนยุ่งยาก ไม่ต้องออกใบแจ้งหนี้เอง",
  },
  {
    q: "สมัครเป็น Partner ทำอย่างไร?",
    a: "ติดต่อทีม Zudobot เพื่อรับ Invitation Link จากนั้นสมัครผ่าน Google Login และเชื่อมต่อ Stripe กระบวนการทั้งหมดใช้เวลาไม่ถึง 15 นาที",
  },
];

/* ─── Page ────────────────────────────────────────── */
export default async function PartnerBenefitPage() {
  const serverPricingFallback = await getPublicPricingData();

  return (
    <>
      <Header />
      <main className="overflow-x-hidden">

        {/* ══════════════════════════════════════════════
            HERO
        ══════════════════════════════════════════════ */}
        <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden pt-28 pb-20 bg-grad-hero">
          {/* Decorative orbs */}
          <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
            <div className="absolute top-1/4 -left-32 w-96 h-96 rounded-full bg-brand-500/15 blur-3xl" />
            <div className="absolute top-1/3 -right-32 w-80 h-80 rounded-full bg-gold-400/15 blur-3xl" />
            <div className="absolute bottom-1/4 left-1/3 w-72 h-72 rounded-full bg-cyan-400/10 blur-3xl" />
          </div>

          <div className="relative z-10 mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/5 text-white/70 text-sm font-medium mb-8 animate-fade-in">
              <span className="w-2 h-2 rounded-full bg-gold-400 animate-pulse" />
              Zudobot Partner Program 2025
            </div>

            <h1 className="font-heading text-5xl sm:text-6xl lg:text-7xl font-extrabold leading-[1.1] tracking-tight mb-6 text-white animate-fade-in">
              เพิ่ม
              <span className="text-grad-gold"> Recurring Revenue </span>
              <br />ให้ธุรกิจของคุณ
            </h1>

            <p className="text-xl sm:text-2xl text-white/65 max-w-2xl mx-auto mb-10 leading-relaxed animate-fade-in">
              นำ Zudobot เสนอลูกค้าร้านค้าออนไลน์ — กำไร{" "}
              <strong className="text-gold-400">45% ทุกเดือน</strong>{" "}
              โดยไม่ต้องพัฒนา AI เอง
            </p>

            <div className="mb-16" />

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-2xl mx-auto">
              {[
                { value: "45%",   label: "Gross Margin" },
                { value: "฿231K", label: "รายได้/ปี (10 ลูกค้า)" },
                { value: "Free",  label: "ค่าสมัคร Partner" },
                { value: "Auto",  label: "รับเงินอัตโนมัติ" },
              ].map((s) => (
                <div key={s.label} className="card-premium px-4 py-4 text-center bg-white/5 border-white/10">
                  <div className="text-2xl font-heading font-extrabold text-grad-gold mb-1">{s.value}</div>
                  <div className="text-xs text-white/50 font-medium">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════
            MARKET STATS
        ══════════════════════════════════════════════ */}
        <section className="py-24 bg-surface-secondary">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <p className="text-brand-500 font-semibold text-sm tracking-widest uppercase mb-3">
                Market Opportunity
              </p>
              <h2 className="font-heading text-4xl sm:text-5xl font-extrabold text-text-primary mb-4">
                ตลาด AI Chatbot{" "}
                <span className="text-grad-blue">กำลังเติบโตอย่างรวดเร็ว</span>
              </h2>
              <p className="text-xl text-text-secondary max-w-2xl mx-auto">
                ข้อมูลจากงานวิจัยชั้นนำยืนยันว่า AI Chatbot กลายเป็น
                Standard ของธุรกิจออนไลน์ทั่วโลก
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {marketStats.map((s) => (
                <div
                  key={s.label}
                  className={`card-premium p-7 bg-gradient-to-br ${
                    s.color === "gold"
                      ? "from-gold-50 to-surface-secondary border-gold-200"
                      : "from-brand-50 to-surface-secondary border-brand-100"
                  }`}
                >
                  <div
                    className={`text-4xl font-heading font-extrabold mb-2 ${
                      s.color === "gold" ? "text-grad-gold" : "text-grad-blue"
                    }`}
                  >
                    {s.value}
                  </div>
                  <div className="text-base font-semibold text-text-primary mb-2">
                    {s.label}
                  </div>
                  <div className="text-sm text-text-secondary leading-relaxed mb-3">
                    {s.detail}
                  </div>
                  <div className="text-xs text-text-muted italic border-t border-border pt-3">
                    Source: {s.source}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════
            CUSTOMER BENEFITS
        ══════════════════════════════════════════════ */}
        <section className="py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <p className="text-gold-500 font-semibold text-sm tracking-widest uppercase mb-3">
                Customer Value
              </p>
              <h2 className="font-heading text-4xl sm:text-5xl font-extrabold text-text-primary mb-4">
                ลูกค้าของคุณได้อะไร
                <br />
                <span className="text-grad-gold">จาก Zudobot?</span>
              </h2>
              <p className="text-xl text-text-secondary max-w-2xl mx-auto">
                ข้อมูล Research-backed ที่คุณสามารถนำไปนำเสนอลูกค้าได้ทันที
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {customerBenefits.map((b) => (
                <div key={b.title} className="card-premium p-7 flex flex-col gap-4">
                  <div className="text-4xl">{b.icon}</div>
                  <div>
                    <h3 className="font-heading text-xl font-bold text-text-primary mb-2">
                      {b.title}
                    </h3>
                    <p className="text-text-secondary leading-relaxed text-sm">
                      {b.desc}
                    </p>
                  </div>
                  <div className="mt-auto pt-3 border-t border-border text-xs text-text-muted italic">
                    Source: {b.source}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════
            PARTNER BENEFITS
        ══════════════════════════════════════════════ */}
        <section className="py-24 bg-surface-secondary">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <p className="text-brand-500 font-semibold text-sm tracking-widest uppercase mb-3">
                Partner Benefits
              </p>
              <h2 className="font-heading text-4xl sm:text-5xl font-extrabold text-text-primary mb-4">
                ทำไม Developer & Agency{" "}
                <br />
                <span className="text-grad-blue">ถึงเลือก Zudobot?</span>
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {partnerBenefits.map((b) => (
                <div
                  key={b.title}
                  className={`card-premium p-7 bg-gradient-to-br flex flex-col gap-4 ${
                    b.color === "gold"
                      ? "from-gold-50 to-surface border-gold-200"
                      : "from-brand-50 to-surface border-brand-100"
                  }`}
                >
                  <div className="text-4xl">{b.icon}</div>
                  <div>
                    <h3 className="font-heading text-xl font-bold text-text-primary mb-2">
                      {b.title}
                    </h3>
                    <p className="text-text-secondary leading-relaxed text-sm">
                      {b.desc}
                    </p>
                  </div>
                  <div
                    className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold mt-auto w-fit ${
                      b.color === "gold"
                        ? "bg-gold-100 text-gold-700 border border-gold-200"
                        : "bg-brand-100 text-brand-600 border border-brand-200"
                    }`}
                  >
                    {b.highlight}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <PartnerBenefitPricingDynamic serverFallback={serverPricingFallback} />

        <section className="py-0 bg-surface-secondary">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 pb-24">
            {/* Accumulation example */}
            <div className="mt-12 card-premium p-7 bg-gradient-to-br from-brand-50 to-surface-secondary border-brand-100">
              <p className="text-sm font-semibold text-brand-500 uppercase tracking-wider mb-4">
                ตัวอย่างการสะสมรายได้ — Pro Plan (฿895 กำไร/เดือน/ลูกค้า)
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
                {[
                  { period: "เดือน 1", amount: 895 },
                  { period: "เดือน 6", amount: 895 * 6 },
                  { period: "เดือน 12", amount: 895 * 12 },
                  { period: "เดือน 36", amount: 895 * 36, gold: true },
                ].map((item) => (
                  <div key={item.period}>
                    <div
                      className={`text-2xl font-heading font-extrabold mb-1 ${
                        item.gold ? "text-grad-gold" : "text-grad-blue"
                      }`}
                    >
                      ฿{item.amount.toLocaleString("th-TH")}
                    </div>
                    <div className="text-sm text-text-muted">{item.period}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════
            HOW IT WORKS
        ══════════════════════════════════════════════ */}
        <section className="py-24">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <p className="text-brand-500 font-semibold text-sm tracking-widest uppercase mb-3">
                How It Works
              </p>
              <h2 className="font-heading text-4xl sm:text-5xl font-extrabold text-text-primary mb-4">
                เริ่มต้นได้ใน{" "}
                <span className="text-grad-blue">3 ขั้นตอน</span>
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
              {/* Connector line (desktop) */}
              <div
                className="hidden md:block absolute top-12 left-[calc(33.3%+16px)] right-[calc(33.3%+16px)] h-px border-t-2 border-dashed border-brand-200"
                aria-hidden="true"
              />

              {steps.map((s) => (
                <div
                  key={s.num}
                  className={`card-premium p-8 flex flex-col items-center text-center gap-5 bg-gradient-to-br ${s.bg} border ${s.border}`}
                >
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-extrabold font-heading flex-shrink-0 ${
                      s.dark
                        ? "bg-gold-400 text-brand-900"
                        : "bg-brand-500 text-white"
                    }`}
                  >
                    {s.num}
                  </div>
                  <div>
                    <h3
                      className={`font-heading text-xl font-bold mb-2 ${
                        s.dark ? "text-white" : "text-text-primary"
                      }`}
                    >
                      {s.title}
                    </h3>
                    <p
                      className={`text-sm leading-relaxed ${
                        s.dark ? "text-white/65" : "text-text-secondary"
                      }`}
                    >
                      {s.desc}
                    </p>
                  </div>
                  <div
                    className={`text-sm font-semibold ${
                      s.dark ? "text-gold-400" : "text-brand-500"
                    }`}
                  >
                    {s.note}
                  </div>
                </div>
              ))}
            </div>

            {/* Dashboard benefits */}
            <div className="mt-10 card-premium p-6 bg-brand-50 border-brand-100">
              <p className="text-sm font-bold text-brand-500 mb-3">
                Partner Dashboard ให้คุณ:
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  "ดูรายชื่อลูกค้าทั้งหมด",
                  "ติดตามสถานะ Subscription",
                  "ดูรายได้สะสม Real-time",
                  "ประวัติการโอนเงินทั้งหมด",
                ].map((item) => (
                  <div
                    key={item}
                    className="flex items-center gap-2 text-sm text-text-secondary"
                  >
                    <span className="w-4 h-4 rounded-full bg-brand-500 text-white text-[10px] flex items-center justify-center flex-shrink-0">
                      ✓
                    </span>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════
            FAQ
        ══════════════════════════════════════════════ */}
        <section className="py-24 bg-surface-secondary">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <p className="text-brand-500 font-semibold text-sm tracking-widest uppercase mb-3">
                FAQ
              </p>
              <h2 className="font-heading text-4xl sm:text-5xl font-extrabold text-text-primary mb-4">
                คำถามที่พบบ่อย
              </h2>
            </div>

            <div className="space-y-4">
              {faqs.map((f) => (
                <div key={f.q} className="card-premium p-6">
                  <h3 className="font-heading text-lg font-bold text-text-primary mb-2">
                    {f.q}
                  </h3>
                  <p className="text-text-secondary leading-relaxed text-sm">
                    {f.a}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════
            CTA
        ══════════════════════════════════════════════ */}
        <section className="py-24 bg-text-primary overflow-hidden relative">
          <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
            <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-brand-500/10 blur-3xl" />
            <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-gold-400/10 blur-3xl" />
          </div>

          <div className="relative z-10 mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/5 text-white/60 text-sm font-medium mb-8">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              พร้อมรับสมัคร Partner แล้ววันนี้
            </div>

            <h2 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white mb-6 leading-tight">
              พร้อมเพิ่ม{" "}
              <span className="text-grad-gold">Recurring Revenue</span>
              <br />ให้ธุรกิจของคุณ?
            </h2>

            <p className="text-xl text-white/60 max-w-2xl mx-auto mb-10">
              ไม่มีค่าสมัคร ไม่มีค่า Setup — เริ่มรับเงินได้ทันที
              <br />ที่ลูกค้าแรกของคุณสมัครใช้งาน
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
              <Link href="https://zudobot.zudogu.com" target="_blank">
                <Button
                  variant="ghost"
                  size="lg"
                  className="w-full sm:w-auto text-white hover:bg-white/10 border border-white/20"
                >
                  zudobot.zudogu.com ↗
                </Button>
              </Link>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-6 text-white/40 text-xs">
              <span>🤝 Free to Join</span>
              <span>•</span>
              <span>💰 45% Margin</span>
              <span>•</span>
              <span>⚡ Setup ใน 10 นาที</span>
              <span>•</span>
              <span>🔁 Recurring Income</span>
              <span>•</span>
              <a href="https://zudogu.com" className="hover:text-white/70 transition-colors">
                🏢 zudogu.com
              </a>
            </div>
          </div>
        </section>

      </main>
      <Footer />
    </>
  );
}
