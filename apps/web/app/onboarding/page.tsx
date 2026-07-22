"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { ZudobotLogo } from "@/components/layout/ZudobotLogo";
import {
  BOT_GENDER_OPTIONS,
  defaultWelcomeMessage,
  type BotGender,
} from "@/lib/ai/botPersonality";
import { PdpaConsentModal } from "@/components/onboarding/PdpaConsentModal";
import {
  BusinessSignupStep,
  type BusinessSignupData,
} from "@/components/onboarding/BusinessSignupModal";

// ─── Types ────────────────────────────────────────────────────────────────────
type BotTone = "friendly" | "formal" | "playful";
type WidgetPos = "bottom-right" | "bottom-left";

interface FormData extends BusinessSignupData {
  // Step 1 (legacy, kept for the optional website field)
  websiteUrl: string;
  // Step 2
  botName: string;
  botGender: BotGender | "";
  botTone: BotTone;
  welcomeMessage: string;
  // Step 3
  widgetColor: string;
  widgetPosition: WidgetPos;
}

const BOT_TONES: { value: BotTone; label: string; desc: string }[] = [
  { value: "friendly", label: "เป็นมิตร", desc: "ภาษาสุภาพ อบอุ่น เข้าถึงง่าย" },
  { value: "formal",   label: "เป็นทางการ", desc: "ภาษาราชการ มืออาชีพ ตรงประเด็น" },
  { value: "playful",  label: "สนุกสนาน", desc: "ภาษาสบายๆ ใช้ emoji บ้าง" },
];

const THEME_COLORS = [
  "#1E5BC6", "#2563EB", "#7C3AED", "#DB2777",
  "#059669", "#D97706", "#DC2626", "#0891B2",
];

const STEPS = [
  { num: 1, label: "ข้อมูลการสมัคร" },
  { num: 2, label: "ตั้งค่าบอท" },
  { num: 3, label: "ออกแบบ Widget" },
  { num: 4, label: "เริ่ม Trial" },
];

// ─── Step components ──────────────────────────────────────────────────────────
function StepBot({ data, onChange }: { data: FormData; onChange: (k: keyof FormData, v: string) => void }) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-heading text-xl font-bold text-text-primary mb-1">ตั้งค่าบอทของคุณ</h2>
        <p className="text-sm text-text-muted">กำหนดบุคลิกและสไตล์การตอบของ AI Agent</p>
      </div>
      <div>
        <label className="block text-xs font-medium text-text-secondary mb-1.5">ชื่อบอท *</label>
        <input
          value={data.botName}
          onChange={(e) => onChange("botName", e.target.value)}
          placeholder="เช่น น้องซี, ZBot, Aria"
          className="w-full bg-surface-secondary border border-border-default rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-400 transition-colors"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-text-secondary mb-2">เพศของบอท (บุคลิก) *</label>
        <p className="text-xs text-text-muted mb-2">กำหนดให้บอทใช้น้ำเสียงผู้หญิงหรือผู้ชาย เพื่อให้การสนทนาเป็นธรรมชาติ</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {BOT_GENDER_OPTIONS.map((g) => (
            <label key={g.value} className={[
              "flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all",
              data.botGender === g.value
                ? "border-brand-500 bg-brand-50"
                : "border-border-default bg-surface-secondary hover:border-brand-300",
            ].join(" ")}>
              <input
                type="radio"
                name="botGender"
                value={g.value}
                checked={data.botGender === g.value}
                onChange={() => onChange("botGender", g.value)}
                className="accent-brand-600"
              />
              <div>
                <p className="text-sm font-medium text-text-primary">{g.label}</p>
                <p className="text-xs text-text-muted">{g.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-text-secondary mb-2">สไตล์การพูด *</label>
        <div className="grid grid-cols-1 gap-2.5">
          {BOT_TONES.map((tone) => (
            <label key={tone.value} className={[
              "flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all",
              data.botTone === tone.value
                ? "border-brand-500 bg-brand-50"
                : "border-border-default bg-surface-secondary hover:border-brand-300",
            ].join(" ")}>
              <input
                type="radio"
                name="tone"
                value={tone.value}
                checked={data.botTone === tone.value}
                onChange={() => onChange("botTone", tone.value)}
                className="accent-brand-600"
              />
              <div>
                <p className="text-sm font-medium text-text-primary">{tone.label}</p>
                <p className="text-xs text-text-muted">{tone.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-text-secondary mb-1.5">ข้อความต้อนรับ</label>
        <textarea
          value={data.welcomeMessage}
          onChange={(e) => onChange("welcomeMessage", e.target.value)}
          placeholder={
            data.botGender === "female"
              ? defaultWelcomeMessage(data.botName || "บอท", "female")
              : data.botGender === "male"
              ? defaultWelcomeMessage(data.botName || "บอท", "male")
              : "เลือกเพศของบอทก่อน แล้วระบบจะแนะนำข้อความต้อนรับ"
          }
          rows={3}
          className="w-full bg-surface-secondary border border-border-default rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-400 transition-colors resize-none"
        />
      </div>
    </div>
  );
}

function StepWidget({ data, onChange }: { data: FormData; onChange: (k: keyof FormData, v: string) => void }) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-heading text-xl font-bold text-text-primary mb-1">ออกแบบ Widget</h2>
        <p className="text-sm text-text-muted">ปรับแต่งสีและตำแหน่งของปุ่ม Chat บนเว็บของคุณ</p>
      </div>

      {/* Color picker */}
      <div>
        <label className="block text-xs font-medium text-text-secondary mb-2">สีหลัก</label>
        <div className="flex items-center gap-2 flex-wrap">
          {THEME_COLORS.map((color) => (
            <button
              key={color}
              onClick={() => onChange("widgetColor", color)}
              className={[
                "w-9 h-9 rounded-full transition-all",
                data.widgetColor === color ? "ring-2 ring-offset-2 ring-brand-600 scale-110" : "hover:scale-105",
              ].join(" ")}
              style={{ background: color }}
            />
          ))}
          <input
            type="color"
            value={data.widgetColor}
            onChange={(e) => onChange("widgetColor", e.target.value)}
            className="w-9 h-9 rounded-full cursor-pointer border border-border-default"
            title="เลือกสีเอง"
          />
        </div>
      </div>

      {/* Position */}
      <div>
        <label className="block text-xs font-medium text-text-secondary mb-2">ตำแหน่งบนเว็บ</label>
        <div className="grid grid-cols-2 gap-2.5">
          {(["bottom-right","bottom-left"] as WidgetPos[]).map((pos) => (
            <label key={pos} className={[
              "flex flex-col items-center gap-2 p-4 rounded-xl border cursor-pointer transition-all",
              data.widgetPosition === pos
                ? "border-brand-500 bg-brand-50"
                : "border-border-default bg-surface-secondary hover:border-brand-300",
            ].join(" ")}>
              <input
                type="radio"
                name="position"
                value={pos}
                checked={data.widgetPosition === pos}
                onChange={() => onChange("widgetPosition", pos)}
                className="sr-only"
              />
              {/* Mini preview */}
              <div className="w-24 h-14 rounded-lg bg-surface-tertiary border border-border-default relative flex-shrink-0">
                <div
                  className={`absolute bottom-2 w-6 h-6 rounded-full ${pos === "bottom-right" ? "right-2" : "left-2"}`}
                  style={{ background: data.widgetColor }}
                />
              </div>
              <span className="text-xs font-medium text-text-secondary">
                {pos === "bottom-right" ? "ขวาล่าง" : "ซ้ายล่าง"}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Live mini preview */}
      <div className="p-4 rounded-xl bg-surface-secondary border border-border-default">
        <p className="text-xs text-text-muted mb-3 font-medium">ตัวอย่างปุ่ม Widget</p>
        <div className="relative h-20 bg-white rounded-lg border border-border-default overflow-hidden">
          <div className={`absolute bottom-3 flex items-center gap-2 ${data.widgetPosition === "bottom-right" ? "right-3" : "left-3"}`}>
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm shadow-md"
              style={{ background: data.widgetColor }}
            >
              💬
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StepTrial({ data, name }: { data: FormData; name?: string | null }) {
  const trialEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  const fmt = trialEnd.toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" });
  return (
    <div className="space-y-5 text-center">
      <div className="w-20 h-20 rounded-full bg-brand-100 flex items-center justify-center text-4xl mx-auto">
        🚀
      </div>
      <div>
        <h2 className="font-heading text-2xl font-bold text-text-primary mb-2">
          พร้อมแล้ว, {name ?? "คุณ"}!
        </h2>
        <p className="text-text-muted text-sm">
          Zudobot ของคุณถูกตั้งค่าเรียบร้อย — คลิก &quot;เริ่มต้นใช้งาน&quot; เพื่อเข้าสู่ Dashboard
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 text-left">
        <div className="p-3.5 rounded-xl bg-surface-secondary border border-border-default">
          <p className="text-xs text-text-muted mb-0.5">ชื่อองค์กร</p>
          <p className="text-sm font-semibold text-text-primary">{data.orgName}</p>
        </div>
        <div className="p-3.5 rounded-xl bg-surface-secondary border border-border-default">
          <p className="text-xs text-text-muted mb-0.5">ชื่อบอท</p>
          <p className="text-sm font-semibold text-text-primary">{data.botName}</p>
        </div>
        <div className="p-3.5 rounded-xl bg-surface-secondary border border-border-default">
          <p className="text-xs text-text-muted mb-0.5">สิ้นสุด Trial</p>
          <p className="text-sm font-semibold text-brand-600">{fmt}</p>
        </div>
      </div>

      <div className="px-4 py-3 rounded-xl bg-brand-50 border border-brand-200">
        <p className="text-sm font-medium text-brand-800">Trial 14 วัน รวมถึง:</p>
        <ul className="mt-2 space-y-1 text-xs text-brand-700 text-left list-none">
          {["✓ 250 ข้อความ/วัน", "✓ Memory 1 MB", "✓ Retention 7 วัน", "✓ 1 ช่องทาง Widget", "✓ ไม่ต้องใช้บัตรเครดิต"].map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ─── Cancel Confirmation Modal ─────────────────────────────────────────────────
function CancelModal({ onConfirm, onClose }: { onConfirm: () => void; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(13,24,41,0.55)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="card-premium w-full max-w-sm p-7 text-center animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon */}
        <div className="w-16 h-16 rounded-full bg-red-50 border border-red-100 flex items-center justify-center text-3xl mx-auto mb-4">
          ⚠️
        </div>

        <h3 className="font-heading text-xl font-bold text-text-primary mb-2">
          ยกเลิกการตั้งค่า?
        </h3>
        <p className="text-sm text-text-secondary leading-relaxed mb-7">
          ข้อมูลทั้งหมดที่กรอกไว้จะหายไป<br />
          คุณแน่ใจหรือไม่ว่าต้องการออกจากหน้านี้?
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-border-default text-sm font-semibold text-text-primary hover:bg-surface-secondary transition-colors"
          >
            ← กลับไปตั้งค่าต่อ
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors"
          >
            ใช่ ยกเลิก
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Wizard ──────────────────────────────────────────────────────────────
const DEFAULT_FORM: FormData = {
  purposeId: "",
  businessCategoryId: "",
  businessSubcategoryId: "",
  orgName: "",
  websiteUrl:   "",
  botName:      "Zudobot",
  botGender:    "",
  botTone:      "friendly",
  welcomeMessage: "",
  widgetColor:    "#1E5BC6",
  widgetPosition: "bottom-right",
};

export default function OnboardingPage() {
  const { data: session, update } = useSession();
  const [step, setStep]         = useState(1);
  const [form, setForm]         = useState<FormData>(DEFAULT_FORM);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [showCancel, setShowCancel] = useState(false);

  // ตรวจสอบว่า user ยอมรับ PDPA แล้วหรือยัง
  const [pdpaStatus, setPdpaStatus] = useState<"checking" | "needed" | "done">("checking");

  useEffect(() => {
    const has = document.cookie.split(";").some((c) => c.trim().startsWith("zudo-pdpa-consent="));
    setPdpaStatus(has ? "done" : "needed");
  }, []);

  function handlePdpaAccept() {
    document.cookie = `zudo-pdpa-consent=${Date.now()}; path=/; max-age=1800; SameSite=Lax`;
    setPdpaStatus("done");
  }

  function handleChange(key: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleBusinessChange(patch: Partial<BusinessSignupData>) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  function canProceed() {
    if (step === 1) {
      return (
        !!form.purposeId &&
        !!form.businessSubcategoryId &&
        !!form.orgName.trim()
      );
    }
    if (step === 2) return !!form.botName.trim() && (form.botGender === "female" || form.botGender === "male");
    return true;
  }

  async function handleNext() {
    if (step < 4) { setStep((s) => s + 1); return; }

    // Step 4 — submit
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purposeId: form.purposeId,
          businessCategoryId: form.businessSubcategoryId,
          orgName: form.orgName,
          websiteUrl: form.websiteUrl,
          botName: form.botName,
          botGender: form.botGender,
          botTone: form.botTone,
          welcomeMessage: form.welcomeMessage,
          widgetColor: form.widgetColor,
          widgetPosition: form.widgetPosition,
        }),
      });
      if (!res.ok) throw new Error("save_failed");
      // Refresh JWT: swaps pendingRegistration → real role/tenantId.
      // update() needs a defined argument — with zero args next-auth sends
      // a plain GET instead of a POST, which never triggers the server
      // jwt() "update" branch that actually resolves pending → real.
      await update({});
      window.location.href = "/auth/redirect";
    } catch {
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่");
      setSaving(false);
    }
  }

  async function handleCancelConfirm() {
    const { signOutWithCleanup } = await import("@/lib/auth/clientCookies");
    await signOutWithCleanup("/login");
  }

  // กำลังตรวจ cookie — แสดง spinner เพื่อป้องกัน flash
  if (pdpaStatus === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-secondary">
        <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // user มาจาก /login โดยตรง ยังไม่ยอมรับ PDPA — scroll-gated consent modal
  if (pdpaStatus === "needed") {
    return <PdpaConsentModal onAccept={handlePdpaAccept} />;
  }

  return (
    <>
      {/* Cancel confirmation modal */}
      {showCancel && (
        <CancelModal
          onConfirm={handleCancelConfirm}
          onClose={() => setShowCancel(false)}
        />
      )}

      <div className="min-h-screen bg-surface-secondary flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-lg">
          {/* Logo row */}
          <div className="flex items-center justify-center mb-6">
            <ZudobotLogo size="sm" variant="color" />
          </div>

          {/* Progress steps */}
          <div className="flex items-center justify-between mb-6 px-2">
            {STEPS.map((s, i) => (
              <div key={s.num} className="flex items-center">
                <div className="flex flex-col items-center gap-1">
                  <div className={[
                    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all",
                    step === s.num ? "bg-brand-600 text-white shadow-brand" :
                    step > s.num  ? "bg-green-500 text-white" :
                    "bg-surface-primary border-2 border-border-default text-text-muted",
                  ].join(" ")}>
                    {step > s.num ? "✓" : s.num}
                  </div>
                  <span className="text-xs text-text-muted hidden sm:block whitespace-nowrap">{s.label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`h-0.5 w-12 sm:w-20 mx-1 transition-colors ${step > s.num ? "bg-green-500" : "bg-border-default"}`} />
                )}
              </div>
            ))}
          </div>

          {/* Card */}
          <div className="card-premium p-7 overflow-y-auto" style={{ maxHeight: "80vh" }}>
            {step === 1 && (
              <BusinessSignupStep
                email={session?.user?.email}
                data={form}
                onChange={handleBusinessChange}
              />
            )}
            {step === 2 && <StepBot    data={form} onChange={handleChange} />}
            {step === 3 && <StepWidget data={form} onChange={handleChange} />}
            {step === 4 && <StepTrial  data={form} name={session?.user?.name} />}

            {error && (
              <div className="mt-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 whitespace-pre-wrap break-words">
                {error}
              </div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between mt-7">
              {step > 1 ? (
                <button
                  onClick={() => setStep((s) => s - 1)}
                  disabled={saving}
                  className="text-sm text-text-secondary hover:text-text-primary transition-colors disabled:opacity-40"
                >
                  ← ย้อนกลับ
                </button>
              ) : <div />}

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowCancel(true)}
                  disabled={saving}
                  className="px-4 py-2.5 rounded-xl border border-border-default text-sm font-semibold text-text-secondary hover:text-red-600 hover:border-red-300 hover:bg-red-50 transition-colors disabled:opacity-40"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleNext}
                  disabled={!canProceed() || saving}
                  className="px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-brand"
                >
                  {saving ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      กำลังบันทึก...
                    </span>
                  ) : step === 4 ? "เริ่มต้นใช้งาน →" : "ถัดไป →"}
                </button>
              </div>
            </div>
          </div>

          <p className="text-center text-xs text-text-muted mt-4">
            ขั้นตอน {step} จาก {STEPS.length} — ใช้เวลาไม่เกิน 2 นาที
          </p>
        </div>
      </div>
    </>
  );
}
