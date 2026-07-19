"use client";

import { useState, useEffect } from "react";
import {
  BOT_GENDER_OPTIONS,
  defaultWelcomeMessage,
  type BotGender,
} from "@/lib/ai/botPersonality";

interface BotForm {
  botName:        string;
  botGender:      BotGender | "";
  botTone:        "friendly" | "formal" | "playful";
  welcomeMessage: string;
}

const TONES: { value: BotForm["botTone"]; label: string; desc: string }[] = [
  { value: "friendly", label: "เป็นกันเอง",   desc: "อบอุ่น ใกล้ชิด เหมาะกับร้านค้าทั่วไป" },
  { value: "formal",   label: "เป็นทางการ",   desc: "สุภาพ มืออาชีพ เหมาะกับธุรกิจ B2B" },
  { value: "playful",  label: "ร่าเริง",       desc: "สนุกสนาน เหมาะกับแบรนด์วัยรุ่น" },
];

function Spinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function BotConfigPage() {
  const [form, setForm]     = useState<BotForm>({
    botName: "",
    botGender: "",
    botTone: "friendly",
    welcomeMessage: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/tenant/me")
      .then((r) => r.json())
      .then((d) => {
        const gender = d.profile?.botGender;
        setForm({
          botName:        d.profile?.botName        ?? "Zudobot",
          botGender:      gender === "male" || gender === "female" ? gender : "female",
          botTone:        d.profile?.botTone         ?? "friendly",
          welcomeMessage: d.profile?.welcomeMessage  ?? "",
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const genderResolved: BotGender =
    form.botGender === "male" ? "male" : "female";

  async function handleSave() {
    if (!form.botName.trim()) {
      setError("กรุณาระบุชื่อบอท");
      return;
    }
    if (form.botGender !== "female" && form.botGender !== "male") {
      setError("กรุณาเลือกเพศของบอท (บังคับ)");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/tenant/bot", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          botGender: form.botGender as BotGender,
        }),
      });
      if (!res.ok) throw new Error("save_failed");
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError("บันทึกไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Spinner />;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-text-primary">Bot Config</h1>
        <p className="text-sm text-text-muted mt-0.5">ตั้งค่าชื่อ บุคลิก เพศ และข้อความต้อนรับของบอท</p>
      </div>

      <div className="bg-surface-primary border border-border-default rounded-2xl p-6 space-y-6">

        {/* Bot Name */}
        <div>
          <label className="block text-sm font-semibold text-text-primary mb-1.5">ชื่อบอท</label>
          <input
            type="text"
            value={form.botName}
            onChange={(e) => setForm((p) => ({ ...p, botName: e.target.value }))}
            maxLength={40}
            placeholder="เช่น Zudobot, ShopAssist, AiMa..."
            className="w-full bg-surface-secondary border border-border-default rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-400 transition-colors"
          />
        </div>

        {/* Bot Gender — mandatory */}
        <div>
          <label className="block text-sm font-semibold text-text-primary mb-1">เพศของบอท (บุคลิก) *</label>
          <p className="text-xs text-text-muted mb-2">
            กำหนดให้บอทใช้น้ำเสียงผู้หญิงหรือผู้ชาย เพื่อให้การสนทนากับลูกค้าเป็นธรรมชาติ
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {BOT_GENDER_OPTIONS.map((g) => (
              <label
                key={g.value}
                className={[
                  "flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all",
                  form.botGender === g.value
                    ? "border-brand-400 bg-brand-50"
                    : "border-border-default hover:border-brand-300",
                ].join(" ")}
              >
                <input
                  type="radio"
                  name="botGender"
                  value={g.value}
                  checked={form.botGender === g.value}
                  onChange={() => setForm((p) => ({ ...p, botGender: g.value }))}
                  className="mt-0.5 accent-brand-600"
                />
                <div>
                  <p className="text-sm font-semibold text-text-primary">{g.label}</p>
                  <p className="text-xs text-text-muted mt-0.5">{g.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Bot Tone */}
        <div>
          <label className="block text-sm font-semibold text-text-primary mb-2">โทนการพูด</label>
          <div className="space-y-2">
            {TONES.map((t) => (
              <label
                key={t.value}
                className={[
                  "flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all",
                  form.botTone === t.value
                    ? "border-brand-400 bg-brand-50"
                    : "border-border-default hover:border-brand-300",
                ].join(" ")}
              >
                <input
                  type="radio"
                  name="botTone"
                  value={t.value}
                  checked={form.botTone === t.value}
                  onChange={() => setForm((p) => ({ ...p, botTone: t.value }))}
                  className="mt-0.5 accent-brand-600"
                />
                <div>
                  <p className="text-sm font-semibold text-text-primary">{t.label}</p>
                  <p className="text-xs text-text-muted mt-0.5">{t.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Welcome Message */}
        <div>
          <label className="block text-sm font-semibold text-text-primary mb-1.5">ข้อความต้อนรับ</label>
          <textarea
            value={form.welcomeMessage}
            onChange={(e) => setForm((p) => ({ ...p, welcomeMessage: e.target.value }))}
            rows={3}
            maxLength={300}
            placeholder={defaultWelcomeMessage(form.botName || "Zudobot", genderResolved)}
            className="w-full bg-surface-secondary border border-border-default rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-400 transition-colors resize-none"
          />
          <p className="text-xs text-text-muted mt-1 text-right">{form.welcomeMessage.length}/300</p>
        </div>

        {/* Preview */}
        <div>
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Preview</p>
          <div className="bg-surface-secondary rounded-xl p-4 border border-border-default">
            <div className="flex items-start gap-2.5 max-w-xs">
              <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {(form.botName || "Z").charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-xs font-semibold text-text-primary mb-1">{form.botName || "Zudobot"}</p>
                <div className="bg-white border border-border-default rounded-2xl rounded-tl-sm px-3 py-2 text-sm text-text-primary shadow-sm">
                  {form.welcomeMessage ||
                    defaultWelcomeMessage(form.botName || "Zudobot", genderResolved)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex items-center justify-end gap-3">
          {saved && <span className="text-xs text-green-600 font-medium">✓ บันทึกแล้ว</span>}
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 shadow-brand"
          >
            {saving ? "กำลังบันทึก..." : "บันทึกการตั้งค่า"}
          </button>
        </div>
      </div>

    </div>
  );
}
