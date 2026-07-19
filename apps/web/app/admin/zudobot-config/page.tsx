"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminBackLink } from "@/components/admin/AdminBackLink";
import { AdminBreadcrumbs } from "@/components/admin/AdminBreadcrumbs";
import { AdminStepUpModal } from "@/components/admin/AdminStepUpModal";
import { GlobalSiteTenantSettings } from "@/components/admin/GlobalSiteTenantSettings";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";

type BotConfigData = {
  botName: string;
  welcomeMessage: string;
  themeColor: string;
  avatarUrl: string;
};

function serializeBotConfig(data: BotConfigData): string {
  return JSON.stringify({
    botName: data.botName,
    welcomeMessage: data.welcomeMessage,
    themeColor: data.themeColor,
    avatarUrl: data.avatarUrl,
  });
}

export default function ZudobotBotConfigPage() {
  const [botName, setBotName] = useState("");
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [themeColor, setThemeColor] = useState("#3B82F6");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [secureToken, setSecureToken] = useState("");

  const isFormDirty =
    savedSnapshot !== null &&
    serializeBotConfig({ botName, welcomeMessage, themeColor, avatarUrl }) !== savedSnapshot;

  useUnsavedChangesGuard(isFormDirty || isDirty);

  const loadConfig = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/admin/global-bot-config", { cache: "no-store" });
      const result = (await res.json()) as {
        success?: boolean;
        data?: BotConfigData;
        error?: string;
      };
      if (!res.ok || !result.success || !result.data) {
        throw new Error(result.error ?? "ไม่สามารถโหลดคอนฟิกของแพลตฟอร์มได้");
      }
      const data = result.data;
      setBotName(data.botName);
      setWelcomeMessage(data.welcomeMessage);
      setThemeColor(data.themeColor);
      setAvatarUrl(data.avatarUrl ?? "");
      setSavedSnapshot(
        serializeBotConfig({
          botName: data.botName,
          welcomeMessage: data.welcomeMessage,
          themeColor: data.themeColor,
          avatarUrl: data.avatarUrl ?? "",
        })
      );
      setIsDirty(false);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "ไม่สามารถโหลดคอนฟิกของแพลตฟอร์มได้";
      setLoadError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  function markDirty() {
    setIsDirty(true);
    setSaveSuccess(null);
    setSaveError(null);
  }

  function triggerSecureVerification() {
    setSecureToken("");
    setShowAuthModal(true);
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
      const res = await fetch("/api/admin/global-bot-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          botName,
          welcomeMessage,
          themeColor,
          avatarUrl,
          secureToken,
        }),
      });
      const result = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !result.success) {
        throw new Error(result.error ?? "ไม่สามารถบันทึกข้อมูลได้");
      }
      const snapshot = serializeBotConfig({ botName, welcomeMessage, themeColor, avatarUrl });
      setSavedSnapshot(snapshot);
      setIsDirty(false);
      setShowAuthModal(false);
      setSecureToken("");
      setSaveSuccess(
        "บันทึกข้อมูลภาพลักษณ์แชทบอทสำเร็จ ตัวตนนี้จะปรากฏในรูปแบบเดียวกันบนทุกเว็บไซต์ภายนอกระบบที่ได้สิทธิ์ Allowed Domains"
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "ไม่สามารถบันทึกข้อมูลได้";
      setSaveError(message);
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return <div className="p-6 text-xs text-zinc-500">กำลังโหลดคอนฟิกแชทบอทระบบสากล...</div>;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6 bg-[#FAFAFA] min-h-screen">
      <AdminBreadcrumbs
        isDirty={isFormDirty || isDirty}
        items={[
          { label: "หน้าหลัก", href: "/admin/tenants" },
          { label: "Bot Config" },
        ]}
      />

      <AdminBackLink href="/admin/tenants" isDirty={isFormDirty || isDirty} />

      <div className="bg-white rounded-2xl p-6 border border-zinc-200 shadow-sm space-y-6">
        <div className="flex justify-between items-center border-b border-zinc-100 pb-4 gap-4">
          <div>
            <h1 className="text-lg font-bold text-zinc-900">
              🤖 สร้างตัวตนแชทบอทส่วนกลาง (Bot Config)
            </h1>
            <p className="text-xs text-zinc-500 mt-0.5">
              ตั้งค่าพฤติกรรมภาพลักษณ์ตัวตนของ Zudobot สำหรับสคริปต์สากล
              การตั้งค่ารูปแบบเดียวกันนี้จะกระจายไปแสดงผลบนเว็บภายนอกทั้งหมดที่ผ่าน Whitelist
            </p>
          </div>
          <button
            type="button"
            onClick={triggerSecureVerification}
            disabled={isSaving}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-sm disabled:opacity-60 flex-shrink-0"
          >
            {isSaving ? "กำลังบันทึก..." : "💾 บันทึกการตั้งค่าบอท"}
          </button>
        </div>

        {loadError && <p className="text-sm text-red-600">{loadError}</p>}
        {saveError && <p className="text-sm text-red-600">{saveError}</p>}
        {saveSuccess && <p className="text-sm text-green-700">{saveSuccess}</p>}

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-1">
            <label className="text-xs font-bold text-zinc-700">ชื่อแชทบอท (Bot Name)</label>
            <input
              type="text"
              className="max-w-md text-xs border border-zinc-300 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={botName}
              onChange={(e) => {
                setBotName(e.target.value);
                markDirty();
              }}
            />
          </div>

          <div className="grid grid-cols-1 gap-1">
            <label className="text-xs font-bold text-zinc-700">
              ข้อความต้อนรับเริ่มต้น (Welcome Message)
            </label>
            <textarea
              rows={3}
              className="max-w-lg text-xs border border-zinc-300 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={welcomeMessage}
              onChange={(e) => {
                setWelcomeMessage(e.target.value);
                markDirty();
              }}
            />
          </div>

          <div className="grid grid-cols-1 gap-1">
            <label className="text-xs font-bold text-zinc-700">
              ธีมสีหน้าต่างแชทภายนอกระบบ (Theme Color)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                className="w-10 h-10 rounded-xl border border-zinc-300 cursor-pointer p-0.5"
                value={themeColor}
                onChange={(e) => {
                  setThemeColor(e.target.value);
                  markDirty();
                }}
              />
              <input
                type="text"
                className="w-28 text-xs border border-zinc-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                value={themeColor}
                onChange={(e) => {
                  setThemeColor(e.target.value);
                  markDirty();
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-1">
            <label className="text-xs font-bold text-zinc-700">Avatar URL (ถ้ามี)</label>
            <input
              type="url"
              className="max-w-lg text-xs border border-zinc-300 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={avatarUrl}
              onChange={(e) => {
                setAvatarUrl(e.target.value);
                markDirty();
              }}
              placeholder="https://..."
            />
          </div>
        </div>
      </div>

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
        description="กรุณากรอกรหัสความปลอดภัยชั่วคราว 6 หลัก จากแอปพลิเคชัน Google Authenticator เพื่อยืนยันการบันทึกการตั้งค่าตัวตนแชทบอทกลาง"
      />

      <GlobalSiteTenantSettings />
    </div>
  );
}
