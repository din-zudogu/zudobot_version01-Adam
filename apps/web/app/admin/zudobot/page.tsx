"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminBreadcrumbs } from "@/components/admin/AdminBreadcrumbs";
import { AdminStepUpModal } from "@/components/admin/AdminStepUpModal";
import { PlatformEmbedAssistant } from "@/components/widget/PlatformEmbedAssistant";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { requirePublicAppUrl } from "@/lib/env/publicAppUrl";
import { normalizeWhitelistDomain } from "@/lib/platform/normalizeWhitelistDomain";

type PlatformConfig = {
  globalEmbedKey: string;
  globalChatTenantId: string;
  whitelistedDomains: string[];
};

export default function ZudobotEmbedAdminPage() {
  const [whitelistInput, setWhitelistInput] = useState("");
  const [domains, setDomains] = useState<string[]>([]);
  const [savedDomains, setSavedDomains] = useState<string[]>([]);
  const [embedKey, setEmbedKey] = useState("");
  const [globalChatTenantId, setGlobalChatTenantId] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [appUrlError, setAppUrlError] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [secureToken, setSecureToken] = useState("");

  useUnsavedChangesGuard(isDirty);

  const loadConfig = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/admin/global-bot-config", { cache: "no-store" });
      const result = (await res.json()) as {
        success?: boolean;
        data?: PlatformConfig;
        error?: string;
      };
      if (!res.ok || !result.success || !result.data) {
        throw new Error(result.error ?? "ไม่สามารถโหลดข้อมูลความปลอดภัยได้");
      }
      const list = result.data.whitelistedDomains ?? [];
      setEmbedKey(result.data.globalEmbedKey);
      setGlobalChatTenantId(result.data.globalChatTenantId ?? "");
      setDomains(list);
      setSavedDomains(list);
      setIsDirty(false);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "ไม่สามารถโหลดข้อมูลความปลอดภัยได้";
      setLoadError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConfig();
    try {
      requirePublicAppUrl();
      setAppUrlError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "config_error";
      setAppUrlError(message);
    }
  }, [loadConfig]);

  let appUrl = "";
  try {
    appUrl = requirePublicAppUrl();
  } catch {
    /* appUrlError state */
  }

  function handleAddDomain() {
    setSaveError(null);
    setSaveSuccess(null);
    const cleanDomain = normalizeWhitelistDomain(whitelistInput);
    if (!cleanDomain) {
      setSaveError("รูปแบบโดเมนไม่ถูกต้อง ตัวอย่าง: domain.com");
      return;
    }
    if (domains.includes(cleanDomain)) {
      setSaveError("โดเมนนี้อยู่ในรายการแล้ว");
      return;
    }
    setDomains([...domains, cleanDomain]);
    setWhitelistInput("");
    setIsDirty(true);
  }

  function handleRemoveDomain(domain: string) {
    setSaveError(null);
    setSaveSuccess(null);
    setDomains(domains.filter((entry) => entry !== domain));
    setIsDirty(true);
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
      const res = await fetch("/api/admin/global-bot-config/whitelist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ whitelistedDomains: domains, secureToken }),
      });
      const result = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !result.success) {
        throw new Error(
          result.error ??
            "รหัสรักษาความปลอดภัยจาก Google Authenticator ไม่ถูกต้อง หรือหมดอายุแล้ว กรุณาลองใหม่อีกครั้ง"
        );
      }
      setSavedDomains(domains);
      setIsDirty(false);
      setShowAuthModal(false);
      setSecureToken("");
      setSaveSuccess(
        "🔒 ยืนยันตนสำเร็จ: ระบบบันทึกรายการ Allowed Domains เรียบร้อยแล้ว!"
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "เกิดข้อผิดพลาดในการบันทึกข้อมูลความปลอดภัย";
      setSaveError(message);
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="p-6 text-xs text-zinc-500">กำลังดาวน์โหลดชุดข้อมูลตรวจสอบสิทธิ์โดเมนภายนอก...</div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 bg-[#FAFAFA] min-h-screen">
      <AdminBreadcrumbs
        isDirty={isDirty}
        items={[
          { label: "หน้าหลัก", href: "/admin/tenants" },
          { label: "การจัดการสคริปต์ติดตั้ง Zudobot (Universal External)" },
        ]}
      />

      <div className="flex justify-between items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">
            🛡️ สิทธิ์ติดตั้งสคริปต์ Zudobot (Universal External Embed)
          </h1>
          <p className="text-xs text-zinc-500 mt-0.5">
            อนุมัติได้หลายโดเมน — ใช้สคริปต์สากลชุดเดียวบนทุกเว็บที่ Whitelist
            (WordPress, Shopify, Custom HTML ฯลฯ) พร้อมคู่มือติดตั้งแยกต่อเว็บ
          </p>
        </div>
        {isDirty && (
          <button
            type="button"
            onClick={triggerSecureVerification}
            disabled={isSaving}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-sm disabled:opacity-60"
          >
            {isSaving ? "กำลังบันทึก..." : "💾 บันทึกสิทธิ์พร้อมตรวจสอบสิทธิ์ผู้ทำรายการ"}
          </button>
        )}
      </div>

      {loadError && <p className="text-sm text-red-600">{loadError}</p>}
      {saveError && <p className="text-sm text-red-600">{saveError}</p>}
      {saveSuccess && <p className="text-sm text-green-700">{saveSuccess}</p>}

      {appUrlError && <p className="text-xs text-red-600">{appUrlError}</p>}

      {appUrl && embedKey ? (
        <PlatformEmbedAssistant
          variant="admin"
          multiSite
          tenantId={globalChatTenantId || "platform-global"}
          embedKey={embedKey}
          appUrl={appUrl}
          allowedDomains={domains}
          scriptPath="/api/public/zudobot/widget.js"
        />
      ) : (
        <div className="bg-white rounded-2xl p-5 border border-zinc-200 text-xs text-zinc-500">
          กำลังโหลดคีย์สคริปต์สากล...
        </div>
      )}

      {embedKey && (
        <p className="text-[11px] text-zinc-500 font-mono px-1">
          globalEmbedKey (PLATFORM_GLOBAL_EMBED_KEY): {embedKey}
          {globalChatTenantId
            ? ` · tenant: ${globalChatTenantId}`
            : " · ตั้ง PLATFORM_GLOBAL_CHAT_TENANT_ID บน Amplify"}
        </p>
      )}

      <div className="bg-white rounded-2xl p-5 border border-zinc-200 shadow-sm space-y-4">
        <div>
          <h2 className="text-sm font-bold text-zinc-900">
            🌐 รายการโดเมนภายนอกที่อนุญาตให้เรียกใช้สคริปต์ (Allowed External Domains Whitelist)
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            ⚠️ เพิ่มได้หลายโดเมน — แต่ละเว็บติดตั้งสคริปต์สากลชุดเดียวกัน
            ระบบอนุญาตเฉพาะ hostname ในรายการนี้ (บันทึกพร้อม 2FA)
          </p>
        </div>

        <div className="flex gap-2 max-w-md">
          <input
            type="text"
            placeholder="เช่น my-wordpress-site.org, customshop.co.th (ไม่ต้องใส่ https://)"
            className="flex-1 text-xs border border-zinc-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={whitelistInput}
            onChange={(e) => setWhitelistInput(e.target.value)}
          />
          <button
            type="button"
            onClick={handleAddDomain}
            className="bg-zinc-900 text-white text-xs px-4 py-2 rounded-xl font-medium hover:bg-zinc-800 transition-colors"
          >
            ตรวจสอบและอนุมัติโดเมน
          </button>
        </div>

        <div className="pt-2 border-t border-zinc-100">
          <span className="text-xs font-bold text-zinc-500 block mb-2">
            รายชื่อเว็บไซต์ภายนอกระบบที่ยืนยันความปลอดภัยสำเร็จ (Allowed Domains List):
          </span>
          <div className="flex flex-wrap gap-2">
            {domains.length === 0 ? (
              <span className="text-xs text-zinc-400 italic">
                ยังไม่มีโดเมนภายนอกใดได้รับการอนุมัติ (สคริปต์จะถูกระงับสัญญาณการแสดงผลทุกเว็บไซต์ปลายทางชั่วคราว)
              </span>
            ) : (
              domains.map((domain) => (
                <span
                  key={domain}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-zinc-100 text-zinc-800 border border-zinc-200"
                >
                  🟢 {domain}
                  <button
                    type="button"
                    onClick={() => handleRemoveDomain(domain)}
                    className="text-zinc-400 hover:text-red-500 font-bold ml-1 text-sm"
                  >
                    ×
                  </button>
                </span>
              ))
            )}
          </div>
          {savedDomains.length > 0 && !isDirty && (
            <p className="text-[11px] text-green-700 mt-2">
              บันทึกล่าสุด: {savedDomains.length} โดเมน
            </p>
          )}
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
        description="กรุณากรอกรหัสความปลอดภัยชั่วคราว 6 หลัก จากแอปพลิเคชัน Google Authenticator เพื่อยืนยันและอนุมัติการเปลี่ยนแปลงสิทธิ์เว็บไซต์ภายนอก"
      />
    </div>
  );
}
