"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminStepUpModal } from "@/components/admin/AdminStepUpModal";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";

type BotTone = "friendly" | "formal" | "playful";
type BotGender = "female" | "male";
type WidgetPosition = "bottom-right" | "bottom-left";

type GlobalSiteTenantData = {
  botName: string;
  welcomeMessage: string;
  botTone: BotTone;
  botGender: BotGender;
  widgetColor: string;
  widgetPosition: WidgetPosition;
  widgetEnabled: boolean;
  allowedDomain: string;
  lineEnabled: boolean;
  lineChannelSecret: string;
  lineChannelToken: string;
  lineOmniEnabled: boolean;
  lineLiffId: string;
  metaEnabled: boolean;
  metaAppSecret: string;
  metaPageAccessToken: string;
  metaPageId: string;
  metaVerifyToken: string;
  tiktokEnabled: boolean;
  tiktokAccessToken: string;
  tiktokWebhookSecret: string;
};

const EMPTY: GlobalSiteTenantData = {
  botName: "",
  welcomeMessage: "",
  botTone: "friendly",
  botGender: "female",
  widgetColor: "#1E5BC6",
  widgetPosition: "bottom-right",
  widgetEnabled: false,
  allowedDomain: "",
  lineEnabled: false,
  lineChannelSecret: "",
  lineChannelToken: "",
  lineOmniEnabled: false,
  lineLiffId: "",
  metaEnabled: false,
  metaAppSecret: "",
  metaPageAccessToken: "",
  metaPageId: "",
  metaVerifyToken: "",
  tiktokEnabled: false,
  tiktokAccessToken: "",
  tiktokWebhookSecret: "",
};

function serialize(data: GlobalSiteTenantData): string {
  return JSON.stringify(data);
}

/**
 * Extends /admin/zudobot-config with settings for the TenantProfile that
 * actually powers the live zudobot.zudogu.com widget (same schema/API as any
 * paying tenant — see ensurePlatformSiteTenantProfile). Kept as a separate
 * component/card so the existing PlatformGlobalBotConfig card above is
 * untouched.
 */
export function GlobalSiteTenantSettings() {
  const [data, setData] = useState<GlobalSiteTenantData>(EMPTY);
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [secureToken, setSecureToken] = useState("");

  const isDirty = savedSnapshot !== null && serialize(data) !== savedSnapshot;
  useUnsavedChangesGuard(isDirty);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/admin/global-site-tenant", { cache: "no-store" });
      const result = (await res.json()) as { success?: boolean; data?: GlobalSiteTenantData; error?: string };
      if (!res.ok || !result.success || !result.data) {
        throw new Error(result.error ?? "ไม่สามารถโหลดค่าตั้งค่าของบอทจริงบนเว็บไซต์ได้");
      }
      setData(result.data);
      setSavedSnapshot(serialize(result.data));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "ไม่สามารถโหลดค่าตั้งค่าของบอทจริงบนเว็บไซต์ได้");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function patch(partial: Partial<GlobalSiteTenantData>) {
    setData((prev) => ({ ...prev, ...partial }));
    setSaveSuccess(null);
    setSaveError(null);
  }

  async function handleConfirmSave() {
    if (secureToken.length !== 6) {
      setSaveError("กรุณากรอกรหัสความปลอดภัยให้ครบถ้วน 6 หลัก");
      return;
    }
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(null);
    try {
      const res = await fetch("/api/admin/global-site-tenant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, secureToken }),
      });
      const result = (await res.json()) as { success?: boolean; data?: GlobalSiteTenantData; error?: string };
      if (!res.ok || !result.success || !result.data) {
        throw new Error(result.error ?? "ไม่สามารถบันทึกข้อมูลได้");
      }
      setData(result.data);
      setSavedSnapshot(serialize(result.data));
      setShowAuthModal(false);
      setSecureToken("");
      setSaveSuccess("บันทึกค่าตั้งค่าบอทจริงบนเว็บไซต์สำเร็จ — มีผลทันทีกับ widget บน zudobot.zudogu.com");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "ไม่สามารถบันทึกข้อมูลได้");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-zinc-200 shadow-sm text-xs text-zinc-500">
        กำลังโหลดค่าตั้งค่าบอทจริงบนเว็บไซต์...
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-6 border border-zinc-200 shadow-sm space-y-6">
      <div className="flex justify-between items-center border-b border-zinc-100 pb-4 gap-4">
        <div>
          <h2 className="text-lg font-bold text-zinc-900">
            🌐 บอทจริงบนเว็บไซต์ zudobot.zudogu.com (Live Site Widget)
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            ค่านี้แก้ TenantProfile เดียวกับที่ widget จริงบนเว็บไซต์อ่านผ่าน /api/widget/init และ
            /api/widget/chat — เป็นระบบเดียวกับที่ tenant ทุกคนใช้ ให้ค่าตั้งค่าของบอทแพลตฟอร์มเอง
            ทำงานเหมือน tenant 100%
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setSecureToken(""); setShowAuthModal(true); }}
          disabled={isSaving}
          className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-sm disabled:opacity-60 flex-shrink-0"
        >
          {isSaving ? "กำลังบันทึก..." : "💾 บันทึก"}
        </button>
      </div>

      {loadError && <p className="text-sm text-red-600">{loadError}</p>}
      {saveError && <p className="text-sm text-red-600">{saveError}</p>}
      {saveSuccess && <p className="text-sm text-green-700">{saveSuccess}</p>}

      {/* ── Persona ─────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Persona</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="grid grid-cols-1 gap-1">
            <label className="text-xs font-bold text-zinc-700">ชื่อแชทบอท (Bot Name)</label>
            <input
              type="text"
              className="text-xs border border-zinc-300 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={data.botName}
              onChange={(e) => patch({ botName: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 gap-1">
            <label className="text-xs font-bold text-zinc-700">น้ำเสียงบอท (Tone)</label>
            <select
              className="text-xs border border-zinc-300 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={data.botTone}
              onChange={(e) => patch({ botTone: e.target.value as BotTone })}
            >
              <option value="friendly">เป็นกันเอง (Friendly)</option>
              <option value="formal">สุภาพเป็นทางการ (Formal)</option>
              <option value="playful">สนุกสนาน (Playful)</option>
            </select>
          </div>

          <div className="grid grid-cols-1 gap-1">
            <label className="text-xs font-bold text-zinc-700">เพศบอท (Gender)</label>
            <select
              className="text-xs border border-zinc-300 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={data.botGender}
              onChange={(e) => patch({ botGender: e.target.value as BotGender })}
            >
              <option value="female">หญิง</option>
              <option value="male">ชาย</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-1">
          <label className="text-xs font-bold text-zinc-700">ข้อความต้อนรับเริ่มต้น (Welcome Message)</label>
          <textarea
            rows={2}
            className="max-w-lg text-xs border border-zinc-300 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={data.welcomeMessage}
            onChange={(e) => patch({ welcomeMessage: e.target.value })}
          />
        </div>
      </section>

      {/* ── Widget ──────────────────────────────────────────────── */}
      <section className="space-y-4 border-t border-zinc-100 pt-4">
        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Widget</h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="grid grid-cols-1 gap-1">
            <label className="text-xs font-bold text-zinc-700">สีธีม (Theme Color)</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                className="w-10 h-10 rounded-xl border border-zinc-300 cursor-pointer p-0.5"
                value={data.widgetColor}
                onChange={(e) => patch({ widgetColor: e.target.value })}
              />
              <input
                type="text"
                className="w-28 text-xs border border-zinc-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                value={data.widgetColor}
                onChange={(e) => patch({ widgetColor: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-1">
            <label className="text-xs font-bold text-zinc-700">ตำแหน่ง widget (Position)</label>
            <select
              className="text-xs border border-zinc-300 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={data.widgetPosition}
              onChange={(e) => patch({ widgetPosition: e.target.value as WidgetPosition })}
            >
              <option value="bottom-right">มุมขวาล่าง</option>
              <option value="bottom-left">มุมซ้ายล่าง</option>
            </select>
          </div>

          <div className="grid grid-cols-1 gap-1">
            <label className="text-xs font-bold text-zinc-700">เปิดใช้งาน Widget</label>
            <label className="inline-flex items-center gap-2 text-xs text-zinc-700 mt-2">
              <input
                type="checkbox"
                checked={data.widgetEnabled}
                onChange={(e) => patch({ widgetEnabled: e.target.checked })}
              />
              widgetEnabled
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-1">
          <label className="text-xs font-bold text-zinc-700">Domain ที่อนุญาต (Allowed Domain)</label>
          <input
            type="text"
            className="max-w-md text-xs border border-zinc-300 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            value={data.allowedDomain}
            onChange={(e) => patch({ allowedDomain: e.target.value })}
            placeholder="zudobot.zudogu.com"
          />
          <p className="text-[11px] text-zinc-400">
            zudobot.zudogu.com ถูก whitelist อัตโนมัติอยู่แล้วผ่าน platform-site bypass —
            ใส่ตรงนี้เพิ่มถ้าต้องการอนุญาต domain อื่นด้วย
          </p>
        </div>
      </section>

      {/* ── Omni-channel ────────────────────────────────────────── */}
      <section className="space-y-4 border-t border-zinc-100 pt-4">
        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wide">Omni-channel</h3>

        <div className="space-y-3">
          <label className="flex items-center gap-2 text-xs font-bold text-zinc-700">
            <input
              type="checkbox"
              checked={data.lineOmniEnabled}
              onChange={(e) => patch({ lineOmniEnabled: e.target.checked })}
            />
            LINE
          </label>
          <div className="grid grid-cols-1 gap-2 pl-6">
            <input
              type="text"
              className="text-xs border border-zinc-300 rounded-xl px-3 py-2 font-mono"
              value={data.lineLiffId}
              onChange={(e) => patch({ lineLiffId: e.target.value })}
              placeholder="LIFF ID"
            />
            <label className="flex items-center gap-2 text-xs text-zinc-600">
              <input
                type="checkbox"
                checked={data.lineEnabled}
                onChange={(e) => patch({ lineEnabled: e.target.checked })}
              />
              เปิดใช้ LINE Messaging API push (admin handoff)
            </label>
            <input
              type="password"
              className="text-xs border border-zinc-300 rounded-xl px-3 py-2 font-mono"
              value={data.lineChannelSecret}
              onChange={(e) => patch({ lineChannelSecret: e.target.value })}
              placeholder="LINE Channel Secret"
            />
            <input
              type="password"
              className="text-xs border border-zinc-300 rounded-xl px-3 py-2 font-mono"
              value={data.lineChannelToken}
              onChange={(e) => patch({ lineChannelToken: e.target.value })}
              placeholder="LINE Channel Access Token"
            />
          </div>
        </div>

        <div className="space-y-3">
          <label className="flex items-center gap-2 text-xs font-bold text-zinc-700">
            <input
              type="checkbox"
              checked={data.metaEnabled}
              onChange={(e) => patch({ metaEnabled: e.target.checked })}
            />
            Meta (Facebook Messenger + Instagram)
          </label>
          <div className="grid grid-cols-1 gap-2 pl-6">
            <input
              type="text"
              className="text-xs border border-zinc-300 rounded-xl px-3 py-2 font-mono"
              value={data.metaPageId}
              onChange={(e) => patch({ metaPageId: e.target.value })}
              placeholder="Meta Page ID"
            />
            <input
              type="password"
              className="text-xs border border-zinc-300 rounded-xl px-3 py-2 font-mono"
              value={data.metaAppSecret}
              onChange={(e) => patch({ metaAppSecret: e.target.value })}
              placeholder="Meta App Secret"
            />
            <input
              type="password"
              className="text-xs border border-zinc-300 rounded-xl px-3 py-2 font-mono"
              value={data.metaPageAccessToken}
              onChange={(e) => patch({ metaPageAccessToken: e.target.value })}
              placeholder="Meta Page Access Token"
            />
            <input
              type="text"
              className="text-xs border border-zinc-300 rounded-xl px-3 py-2 font-mono"
              value={data.metaVerifyToken}
              onChange={(e) => patch({ metaVerifyToken: e.target.value })}
              placeholder="Meta Webhook Verify Token"
            />
          </div>
        </div>

        <div className="space-y-3">
          <label className="flex items-center gap-2 text-xs font-bold text-zinc-700">
            <input
              type="checkbox"
              checked={data.tiktokEnabled}
              onChange={(e) => patch({ tiktokEnabled: e.target.checked })}
            />
            TikTok
          </label>
          <div className="grid grid-cols-1 gap-2 pl-6">
            <input
              type="password"
              className="text-xs border border-zinc-300 rounded-xl px-3 py-2 font-mono"
              value={data.tiktokAccessToken}
              onChange={(e) => patch({ tiktokAccessToken: e.target.value })}
              placeholder="TikTok Access Token"
            />
            <input
              type="password"
              className="text-xs border border-zinc-300 rounded-xl px-3 py-2 font-mono"
              value={data.tiktokWebhookSecret}
              onChange={(e) => patch({ tiktokWebhookSecret: e.target.value })}
              placeholder="TikTok Webhook Secret"
            />
          </div>
        </div>
      </section>

      <AdminStepUpModal
        open={showAuthModal}
        secureToken={secureToken}
        isSubmitting={isSaving}
        onSecureTokenChange={setSecureToken}
        onCancel={() => {
          if (!isSaving) {
            setShowAuthModal(false);
            setSecureToken("");
          }
        }}
        onConfirm={() => void handleConfirmSave()}
        description="กรุณากรอกรหัสความปลอดภัยชั่วคราว 6 หลัก จากแอปพลิเคชัน Google Authenticator เพื่อยืนยันการบันทึกค่าตั้งค่าบอทจริงบนเว็บไซต์"
      />
    </div>
  );
}
