"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CHROME_EXTENSION_ID,
  CHROME_WEB_STORE_URL,
  chromeWebStoreUrl,
  getChromeRuntime,
} from "@/lib/widget/integration/chromeExtension";
import { confirmLeaveWhenDirty } from "@/lib/admin/unsavedChanges";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { normalizeWhitelistDomain } from "@/lib/platform/normalizeWhitelistDomain";

type TabId = "extension" | "manual";

type Props = {
  tenantId: string;
  /** รหัสฝังของร้าน (ใช้ภายในระบบ ไม่แสดงให้ลูกค้า) */
  embedKey: string;
};

type ExtCheckResponse = {
  status?: string;
  installed?: boolean;
  version?: string;
};

type InjectResponse = { success?: boolean; error?: string; message?: string };

export function ZudobotIntegration({ tenantId, embedKey }: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>("manual");
  const [isExtensionInstalled, setIsExtensionInstalled] = useState(false);
  const [checkingExtension, setCheckingExtension] = useState(true);
  const [embedCode, setEmbedCode] = useState("");
  const [loadingCode, setLoadingCode] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [injecting, setInjecting] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const [savedDomain, setSavedDomain] = useState<string | null>(null);
  const [domainInput, setDomainInput] = useState("");
  const [savingDomain, setSavingDomain] = useState(false);
  const [removingDomain, setRemovingDomain] = useState(false);
  const [domainMsg, setDomainMsg] = useState<string | null>(null);
  const [domainError, setDomainError] = useState<string | null>(null);
  const [domainsLoaded, setDomainsLoaded] = useState(false);

  const extensionId = CHROME_EXTENSION_ID;
  const storeUrl = useMemo(
    () =>
      extensionId
        ? chromeWebStoreUrl(extensionId)
        : CHROME_WEB_STORE_URL || "",
    [extensionId]
  );
  const storeReady = Boolean(storeUrl);

  const isDomainDirty = useMemo(() => {
    const normalized = normalizeWhitelistDomain(domainInput);
    if (!savedDomain) return Boolean(normalized);
    return false;
  }, [domainInput, savedDomain]);

  useUnsavedChangesGuard(isDomainDirty);

  const guardedNavigate = useCallback(
    (href: string) => {
      if (!confirmLeaveWhenDirty(isDomainDirty)) return;
      router.push(href);
    },
    [isDomainDirty, router]
  );

  const checkExtensionPresence = useCallback(() => {
    if (!extensionId) {
      setIsExtensionInstalled(false);
      setCheckingExtension(false);
      return;
    }

    const runtime = getChromeRuntime();
    if (!runtime?.sendMessage) {
      setIsExtensionInstalled(false);
      setCheckingExtension(false);
      return;
    }

    setCheckingExtension(true);
    runtime.sendMessage(
      extensionId,
      { action: "CHECK_ZUDOBOT_EXTENSION" },
      (response: unknown) => {
        const err = runtime.lastError?.message;
        if (err) {
          setIsExtensionInstalled(false);
        } else {
          const res = response as ExtCheckResponse | undefined;
          setIsExtensionInstalled(
            res?.status === "ACTIVE" || res?.installed === true
          );
        }
        setCheckingExtension(false);
      }
    );
  }, [extensionId]);

  useEffect(() => {
    checkExtensionPresence();
  }, [checkExtensionPresence]);

  const loadDomains = useCallback(async () => {
    try {
      const r = await fetch("/api/tenant/domains", { cache: "no-store" });
      const d = (await r.json()) as { domain?: string | null };
      const dmn = d.domain?.trim() ?? "";
      setSavedDomain(dmn || null);
      setDomainInput(dmn);
    } catch {
      /* keep previous */
    } finally {
      setDomainsLoaded(true);
    }
  }, []);

  useEffect(() => {
    void loadDomains();
  }, [loadDomains]);

  const fetchEmbedSnippet = useCallback(async () => {
    setLoadingCode(true);
    setCodeError(null);
    try {
      const res = await fetch("/api/tenant/embed-snippet", { cache: "no-store" });
      const data = (await res.json()) as {
        ok?: boolean;
        embedScript?: string;
        message?: string;
      };
      if (res.ok && data.ok && data.embedScript) {
        setEmbedCode(data.embedScript);
      } else {
        setEmbedCode("");
        setCodeError(
          data.message ??
            "ยังสร้างโค้ดไม่ได้ กดโหลดใหม่หรือติดต่อทีมงาน Zudobot"
        );
      }
    } catch {
      setEmbedCode("");
      setCodeError("โหลดโค้ดไม่สำเร็จ ตรวจอินเทอร์เน็ตแล้วลองใหม่");
    } finally {
      setLoadingCode(false);
    }
  }, []);

  const refreshEmbedAfterDomainChange = useCallback(async () => {
    if (activeTab === "manual") {
      await fetchEmbedSnippet();
    }
  }, [activeTab, fetchEmbedSnippet]);

  useEffect(() => {
    if (activeTab === "manual" && domainsLoaded) void fetchEmbedSnippet();
  }, [activeTab, domainsLoaded, fetchEmbedSnippet]);

  async function triggerAutoInjection() {
    if (!extensionId) {
      window.alert(
        "ตัวช่วยติดตั้งอัตโนมัติยังไม่พร้อม — ใช้แท็บ「คัดลอกโค้ด」ด้านบนแทนได้เลย"
      );
      return;
    }

    const runtime = getChromeRuntime();
    if (!runtime?.sendMessage) {
      window.alert("กรุณาใช้เบราว์เซอร์ Google Chrome และติดตั้งตัวช่วยจาก Chrome Web Store ก่อน");
      return;
    }

    setInjecting(true);
    runtime.sendMessage(
      extensionId,
      {
        action: "INJECT_WIDGET_SCRIPT",
        tenantId,
        widgetId: embedKey,
      },
      (response: unknown) => {
        setInjecting(false);
        const err = runtime.lastError?.message;
        if (err) {
          window.alert(
            "ยังติดตั้งไม่ได้ — เปิดแท็บเว็บร้านของคุณก่อน แล้วกดปุ่มนี้อีกครั้ง"
          );
          return;
        }
        const res = response as InjectResponse | undefined;
        if (res?.success) {
          window.alert(
            "ติดตั้งสคริปต์แชทบอทเข้าเว็บร้านของคุณสำเร็จแล้ว"
          );
        } else {
          window.alert(
            "เปิดแท็บเว็บร้านของคุณ (โดเมนที่บันทึกไว้ด้านล่าง) ค้างไว้ แล้วกดปุ่มนี้อีกครั้ง"
          );
        }
      }
    );
  }

  function handleConnectAccount() {
    if (!extensionId || !getChromeRuntime()?.sendMessage) return;
    setConnecting(true);
    getChromeRuntime()!.sendMessage(
      extensionId,
      { action: "TRIGGER_OAUTH" },
      () => {
        setConnecting(false);
        checkExtensionPresence();
      }
    );
  }

  async function handleSaveDomain() {
    const clean = normalizeWhitelistDomain(domainInput);
    if (!clean) {
      setDomainError("รูปแบบไม่ถูกต้อง ตัวอย่าง: myshop.com");
      return;
    }
    setSavingDomain(true);
    setDomainError(null);
    setDomainMsg(null);
    const res = await fetch("/api/tenant/domains", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain: clean }),
    });
    const data = (await res.json()) as { ok?: boolean; domain?: string; error?: string };
    setSavingDomain(false);
    if (!res.ok) {
      const errMap: Record<string, string> = {
        invalid_domain: "รูปแบบโดเมนไม่ถูกต้อง (ตัวอย่าง: shop.com)",
        single_domain_only: "ระบุได้ 1 โดเมนเท่านั้น",
      };
      setDomainError(errMap[data.error ?? ""] ?? "บันทึกไม่สำเร็จ");
      return;
    }
    const saved = data.domain ?? clean;
    setSavedDomain(saved);
    setDomainInput(saved);
    setDomainMsg("บันทึกที่อยู่เว็บเรียบร้อยแล้ว — กำลังอัปเดตโค้ดติดตั้ง...");
    void fetch("/api/tenant/knowledge/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: `https://${saved}` }),
    });
    await refreshEmbedAfterDomainChange();
    setDomainMsg("บันทึกที่อยู่เว็บเรียบร้อยแล้ว — โค้ดติดตั้งอัปเดตแล้ว");
  }

  async function handleRemoveDomain() {
    if (
      !window.confirm(
        "ต้องการลบโดเมนนี้และระบุใหม่ใช่หรือไม่? แชทบอทจะไม่ทำงานบนเว็บเดิมจนกว่าจะบันทึกโดเมนใหม่"
      )
    ) {
      return;
    }
    setRemovingDomain(true);
    setDomainError(null);
    setDomainMsg(null);
    try {
      const res = await fetch("/api/tenant/domains", { method: "DELETE" });
      if (!res.ok) {
        setDomainError("ลบโดเมนไม่สำเร็จ กรุณาลองใหม่");
        return;
      }
      setSavedDomain(null);
      setDomainInput("");
      setDomainMsg("ลบโดเมนแล้ว — ระบุโดเมนใหม่ด้านล่าง");
      setEmbedCode("");
      await refreshEmbedAfterDomainChange();
    } finally {
      setRemovingDomain(false);
    }
  }

  function handleCopyCode() {
    if (!embedCode) return;
    void navigator.clipboard.writeText(embedCode).then(() => {
      window.alert("คัดลอกโค้ดสำเร็จ นำไปวางในหลังบ้านเว็บของคุณได้ทันที");
    });
  }

  const tabClass = (tab: TabId) =>
    [
      "px-4 py-3 text-sm font-medium border-b-2 transition-colors",
      activeTab === tab
        ? "border-brand-600 text-brand-700"
        : "border-transparent text-text-muted hover:text-text-primary",
    ].join(" ");

  return (
    <div className="max-w-3xl space-y-6">
      <nav className="text-sm text-text-muted" aria-label="นำทาง">
        <Link
          href="/dashboard/overview"
          className="text-brand-600 hover:underline"
          onClick={(e) => {
            if (!confirmLeaveWhenDirty(isDomainDirty)) e.preventDefault();
          }}
        >
          หน้าหลัก
        </Link>
        <span className="mx-2">›</span>
        <span className="text-text-primary font-medium">ติดตั้งแชทบอทบนเว็บไซต์</span>
      </nav>

      <div className="bg-surface-primary border border-border-default rounded-2xl p-6 shadow-sm space-y-5">
        <div>
          <h1 className="font-heading text-xl font-bold text-text-primary">
            ติดตั้งระบบแชทบอท Zudobot เข้ากับเว็บไซต์ของคุณ
          </h1>
          <p className="text-sm text-text-muted mt-1">
            เลือกวิธีเปิดใช้งานตัวช่วยตอบคำถามบนเว็บร้านตามความสะดวก
          </p>
        </div>

        <div className="flex border-b border-border-default -mx-1">
          <button type="button" className={tabClass("extension")} onClick={() => setActiveTab("extension")}>
            วิธีที่ 1: ติดตั้งอัตโนมัติด้วย Chrome Extension
          </button>
          <button type="button" className={tabClass("manual")} onClick={() => setActiveTab("manual")}>
            วิธีที่ 2: คัดลอกโค้ดติดตั้งเอง
          </button>
        </div>

        {activeTab === "extension" && (
          <div className="space-y-4">
            <div className="rounded-xl bg-brand-50 border border-brand-100 p-4 text-sm text-text-secondary leading-relaxed">
              <p className="font-semibold text-brand-800 mb-1">ระบบติดตั้งอัตโนมัติทำงานอย่างไร?</p>
              <p>
                เพิ่มตัวช่วย Zudobot ใน Chrome ครั้งเดียว จากนั้นเปิดเว็บร้านของคุณ
                แล้วกดปุ่มด้านล่างเพื่อฝังแชทบอททันที — ไม่ต้องแก้ไฟล์โค้ดเว็บเอง
              </p>
            </div>

            {checkingExtension ? (
              <p className="text-sm text-text-muted italic">กำลังตรวจสอบตัวช่วยบน Chrome...</p>
            ) : !storeReady ? (
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900">
                ตัวช่วย Chrome กำลังเปิดให้บริการเร็วๆ นี้ — ใช้「วิธีที่ 2: คัดลอกโค้ด」แทนได้ทันที
              </div>
            ) : !isExtensionInstalled ? (
              <div className="rounded-xl border border-border-default bg-surface-secondary p-6 text-center space-y-3">
                <p className="text-sm font-semibold text-text-primary">
                  ยังไม่ได้ติดตั้งตัวช่วยบน Chrome
                </p>
                <button
                  type="button"
                  onClick={() => window.open(storeUrl, "_blank", "noopener,noreferrer")}
                  className="w-full max-w-md mx-auto py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-semibold"
                >
                  ไปดาวน์โหลดจาก Chrome Web Store
                </button>
                <p className="text-xs text-text-muted">
                  หลังกด「เพิ่มใน Chrome」แล้ว กลับมาหน้านี้และกดตรวจสอบอีกครั้ง
                </p>
                <button
                  type="button"
                  onClick={checkExtensionPresence}
                  className="text-xs font-medium text-brand-600 hover:text-brand-700"
                >
                  ตรวจสอบอีกครั้ง
                </button>
              </div>
            ) : (
              <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center space-y-3">
                <p className="text-sm font-semibold text-green-800">
                  พบตัวช่วยติดตั้งบน Chrome แล้ว — พร้อมใช้งาน
                </p>
                <p className="text-xs text-green-700">
                  ขั้นที่ 1: กด「เชื่อมต่อบัญชี」 (ครั้งแรก) · ขั้นที่ 2: เปิดแท็บเว็บร้าน · ขั้นที่ 3: กดปุ่มสีเขียว
                </p>
                <div className="flex flex-col sm:flex-row gap-2 justify-center">
                  <button
                    type="button"
                    disabled={connecting}
                    onClick={handleConnectAccount}
                    className="px-5 py-2.5 rounded-xl border border-brand-300 bg-white text-brand-700 text-sm font-semibold disabled:opacity-50"
                  >
                    {connecting ? "กำลังเชื่อมต่อ..." : "เชื่อมต่อบัญชี"}
                  </button>
                  <button
                    type="button"
                    disabled={injecting}
                    onClick={() => void triggerAutoInjection()}
                    className="px-5 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-semibold disabled:opacity-50"
                  >
                    {injecting ? "กำลังติดตั้ง..." : "เปิดใช้งานแชทบอทบนเว็บฉันทันที"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "manual" && (
          <div className="space-y-4">
            <p className="text-sm text-text-secondary">
              ใช้ได้กับ Safari, Firefox หรือเมื่อต้องการวางโค้ดในหลังบ้านเว็บเอง
            </p>

            {loadingCode ? (
              <div className="py-10 text-center text-sm text-text-muted border border-dashed border-border-default rounded-xl">
                กำลังสร้างชุดโค้ดสำหรับร้านของคุณ...
              </div>
            ) : (
              <>
                <div className="relative">
                  <pre className="bg-gray-950 text-green-400 rounded-xl p-4 text-xs overflow-x-auto font-mono whitespace-pre-wrap min-h-[4rem]">
                    {embedCode || codeError || "ยังไม่มีโค้ด — กดโหลดใหม่"}
                  </pre>
                  {embedCode && (
                    <button
                      type="button"
                      onClick={handleCopyCode}
                      className="absolute top-2 right-2 text-xs font-semibold px-3 py-1.5 rounded-lg bg-brand-600 text-white hover:bg-brand-700"
                    >
                      คัดลอกโค้ด
                    </button>
                  )}
                </div>
                {!embedCode && (
                  <button
                    type="button"
                    onClick={() => void fetchEmbedSnippet()}
                    className="text-sm font-medium text-brand-600 hover:text-brand-700"
                  >
                    โหลดโค้ดใหม่
                  </button>
                )}
                <div className="rounded-xl bg-amber-50 border border-amber-100 p-4 text-sm text-amber-900">
                  <p className="font-semibold mb-1">วิธีนำไปวาง</p>
                  <p>
                    คัดลอกโค้ดด้านบน ไปวางในหลังบ้านเว็บ (ช่อง HTML / Script หรือก่อนแท็กปิด{" "}
                    <code className="font-mono font-bold">&lt;/body&gt;</code>) แล้วกดบันทึก
                  </p>
                </div>
              </>
            )}
          </div>
        )}

        <div className="border-t border-border-default pt-5 space-y-3">
          <h3 className="text-sm font-semibold text-text-primary">
            ระบบตรวจสอบความปลอดภัยโดเมน
          </h3>
          <p className="text-xs text-text-muted">
            ระบุชื่อเว็บร้านของคุณ (เช่น myshop.com) เพื่อไม่ให้คนอื่นนำแชทบอทของคุณไปใช้บนเว็บอื่น
          </p>

          {!domainsLoaded ? (
            <p className="text-xs text-text-muted italic">กำลังโหลดโดเมน...</p>
          ) : savedDomain ? (
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-green-50 border border-green-200">
                <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                <span className="text-sm font-mono font-medium text-green-900">
                  {savedDomain}
                </span>
              </div>
              <button
                type="button"
                disabled={removingDomain}
                onClick={() => void handleRemoveDomain()}
                className="text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50 px-2 py-1 rounded-lg hover:bg-red-50"
              >
                {removingDomain ? "กำลังลบ..." : "เปลี่ยน / ลบ"}
              </button>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-2 max-w-lg">
              <input
                type="text"
                value={domainInput}
                onChange={(e) => {
                  setDomainInput(e.target.value);
                  setDomainError(null);
                  setDomainMsg(null);
                }}
                placeholder="ตัวอย่าง: myshop.com"
                className="flex-1 bg-surface-secondary border border-border-default rounded-xl px-3 py-2.5 text-sm font-mono"
              />
              <button
                type="button"
                disabled={savingDomain || !normalizeWhitelistDomain(domainInput)}
                onClick={() => void handleSaveDomain()}
                className="px-5 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-900 text-white text-sm font-semibold disabled:opacity-50"
              >
                {savingDomain ? "กำลังบันทึก..." : "บันทึกที่อยู่เว็บ"}
              </button>
            </div>
          )}

          {domainError && <p className="text-xs text-red-500">{domainError}</p>}
          {domainMsg && <p className="text-xs text-green-600">{domainMsg}</p>}
        </div>

        <button
          type="button"
          onClick={() => guardedNavigate("/dashboard/overview")}
          className="text-sm text-text-muted hover:text-text-primary border border-border-default px-4 py-2 rounded-lg"
        >
          ← ย้อนกลับหน้าหลัก
        </button>
      </div>
    </div>
  );
}
