"use client";

import { useState, useEffect } from "react";

interface TwoFAStatus {
  enabled:  boolean;
  verified: boolean;
}

type SetupStep = "idle" | "loading" | "qr" | "verifying" | "done" | "error";
type DisableStep = "idle" | "confirming" | "disabling" | "done" | "error";

export default function SecurityPage() {
  const [status, setStatus]   = useState<TwoFAStatus | null>(null);
  const [loading, setLoading] = useState(true);

  // Setup flow
  const [setupStep, setSetupStep]   = useState<SetupStep>("idle");
  const [qrUri, setQrUri]           = useState<string | null>(null);
  const [secret, setSecret]         = useState<string | null>(null);
  const [setupCode, setSetupCode]   = useState("");
  const [setupError, setSetupError] = useState<string | null>(null);

  // Disable flow
  const [disableStep, setDisableStep]   = useState<DisableStep>("idle");
  const [disableCode, setDisableCode]   = useState("");
  const [disableError, setDisableError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/tenant/me")
      .then((r) => r.json())
      .then((d) => {
        setStatus({
          enabled:  !!d.user?.twoFactorEnabled,
          verified: !!d.user?.twoFactorVerified,
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // ── Start 2FA Setup ──────────────────────────────────────────────

  async function startSetup() {
    setSetupStep("loading");
    setSetupError(null);
    try {
      const res = await fetch("/api/tenant/2fa/setup", { method: "POST" });
      const data = await res.json() as { secret?: string; uri?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "setup_failed");
      setSecret(data.secret ?? null);
      setQrUri(data.uri ?? null);
      setSetupStep("qr");
    } catch (e) {
      setSetupError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
      setSetupStep("error");
    }
  }

  async function verifySetup() {
    setSetupStep("verifying");
    setSetupError(null);
    try {
      const res = await fetch("/api/tenant/2fa/verify", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ code: setupCode }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        const msgs: Record<string, string> = {
          invalid_code: "รหัสไม่ถูกต้อง กรุณาลองใหม่",
          code_required: "กรุณากรอกรหัส 6 หลัก",
        };
        throw new Error(msgs[data.error ?? ""] ?? data.error ?? "verify_failed");
      }
      setStatus({ enabled: true, verified: true });
      setSetupStep("done");
    } catch (e) {
      setSetupError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
      setSetupStep("qr");
    }
  }

  // ── Disable 2FA ──────────────────────────────────────────────────

  async function disable2FA() {
    setDisableStep("disabling");
    setDisableError(null);
    try {
      const res = await fetch("/api/tenant/2fa/disable", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ code: disableCode }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        const msgs: Record<string, string> = {
          invalid_code: "รหัสไม่ถูกต้อง กรุณาลองใหม่",
        };
        throw new Error(msgs[data.error ?? ""] ?? data.error ?? "disable_failed");
      }
      setStatus({ enabled: false, verified: false });
      setDisableStep("done");
    } catch (e) {
      setDisableError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
      setDisableStep("confirming");
    }
  }

  // ── QR code display (URL → img via Google Charts API) ───────────

  function qrImgUrl(uri: string): string {
    return `https://chart.googleapis.com/chart?chs=200x200&chld=M|0&cht=qr&chl=${encodeURIComponent(uri)}`;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-text-primary">ความปลอดภัย</h1>
        <p className="text-sm text-text-muted mt-0.5">จัดการการยืนยันตัวตนสองขั้นตอน (2FA)</p>
      </div>

      {/* 2FA Status Card */}
      <div className="bg-surface-primary border border-border-default rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-text-primary">การยืนยันตัวตน 2 ขั้นตอน (2FA)</p>
            <p className="text-xs text-text-muted mt-0.5">ใช้ Authenticator App เช่น Google Authenticator หรือ Authy</p>
          </div>
          <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
            status?.enabled ? "bg-green-100 text-green-700" : "bg-surface-secondary text-text-muted"
          }`}>
            {status?.enabled ? "เปิดอยู่" : "ปิดอยู่"}
          </span>
        </div>

        {/* Setup flow */}
        {!status?.enabled && (
          <>
            {setupStep === "idle" && (
              <button
                onClick={startSetup}
                className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition-colors"
              >
                เปิดใช้งาน 2FA
              </button>
            )}

            {setupStep === "loading" && (
              <div className="flex items-center gap-2 text-sm text-text-muted">
                <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                กำลังสร้าง QR Code...
              </div>
            )}

            {setupStep === "error" && (
              <div className="space-y-2">
                <p className="text-sm text-red-500">{setupError}</p>
                <button onClick={() => setSetupStep("idle")} className="text-xs text-brand-600 underline">
                  ลองใหม่
                </button>
              </div>
            )}

            {(setupStep === "qr" || setupStep === "verifying") && qrUri && (
              <div className="space-y-4">
                <div className="p-4 bg-surface-secondary rounded-xl space-y-3">
                  <p className="text-xs font-semibold text-text-secondary">ขั้นตอนที่ 1: สแกน QR Code</p>
                  <div className="flex justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={qrImgUrl(qrUri)}
                      alt="QR Code for 2FA"
                      width={180}
                      height={180}
                      className="rounded-lg border border-border-default"
                    />
                  </div>
                  {secret && (
                    <div className="text-center">
                      <p className="text-xs text-text-muted mb-1">หรือกรอก Secret Key:</p>
                      <code className="text-xs font-mono bg-surface-primary px-3 py-1 rounded-lg border border-border-default select-all">
                        {secret}
                      </code>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-text-secondary">ขั้นตอนที่ 2: กรอกรหัส 6 หลักจาก App</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      value={setupCode}
                      onChange={(e) => setSetupCode(e.target.value.replace(/\D/g, ""))}
                      placeholder="123456"
                      className="flex-1 bg-surface-secondary border border-border-default rounded-xl px-3 py-2.5 text-sm text-text-primary font-mono tracking-widest text-center focus:outline-none focus:border-brand-400"
                    />
                    <button
                      onClick={verifySetup}
                      disabled={setupCode.length !== 6 || setupStep === "verifying"}
                      className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition-colors disabled:opacity-50"
                    >
                      {setupStep === "verifying" ? "กำลังตรวจสอบ..." : "ยืนยัน"}
                    </button>
                  </div>
                  {setupError && <p className="text-xs text-red-500">{setupError}</p>}
                </div>
              </div>
            )}

            {setupStep === "done" && (
              <div className="p-4 bg-green-50 rounded-xl border border-green-200">
                <p className="text-sm font-semibold text-green-700">✅ เปิด 2FA สำเร็จ!</p>
                <p className="text-xs text-green-600 mt-1">ทุกครั้งที่ login คุณจะต้องกรอกรหัสจาก Authenticator App</p>
              </div>
            )}
          </>
        )}

        {/* Disable flow */}
        {status?.enabled && (
          <>
            <div className="p-3 bg-green-50 rounded-xl border border-green-200 text-xs text-green-700">
              ✅ 2FA เปิดใช้งานอยู่ — บัญชีของคุณได้รับการปกป้องด้วย Authenticator App
            </div>

            {disableStep === "idle" && (
              <button
                onClick={() => setDisableStep("confirming")}
                className="px-5 py-2.5 rounded-xl bg-surface-secondary border border-border-default hover:border-red-300 text-text-secondary hover:text-red-600 text-sm font-semibold transition-colors"
              >
                ปิด 2FA
              </button>
            )}

            {disableStep === "confirming" && (
              <div className="space-y-3 p-4 bg-surface-secondary rounded-xl border border-border-default">
                <p className="text-xs font-semibold text-text-primary">กรอกรหัส 6 หลักจาก App เพื่อยืนยันการปิด 2FA</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={disableCode}
                    onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="123456"
                    className="flex-1 bg-surface-primary border border-border-default rounded-xl px-3 py-2.5 text-sm text-text-primary font-mono tracking-widest text-center focus:outline-none focus:border-brand-400"
                  />
                  <button
                    onClick={disable2FA}
                    disabled={disableCode.length !== 6}
                    className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors disabled:opacity-50"
                  >
                    ปิด 2FA
                  </button>
                </div>
                {disableError && <p className="text-xs text-red-500">{disableError}</p>}
                <button onClick={() => setDisableStep("idle")} className="text-xs text-text-muted underline">
                  ยกเลิก
                </button>
              </div>
            )}

            {disableStep === "done" && (
              <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                <p className="text-sm font-semibold text-amber-700">2FA ปิดแล้ว — แนะนำให้เปิดใหม่เพื่อความปลอดภัย</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Info Section */}
      <div className="bg-surface-primary border border-border-default rounded-2xl p-6 space-y-3">
        <p className="text-sm font-bold text-text-primary">แนะนำ Authenticator Apps</p>
        <div className="space-y-2 text-xs text-text-secondary">
          {[
            ["Google Authenticator", "iOS / Android — ใช้งานง่าย"],
            ["Authy", "iOS / Android / Desktop — รองรับ backup"],
            ["Microsoft Authenticator", "iOS / Android — รองรับ backup ใน cloud"],
            ["1Password / Bitwarden", "Password Manager ที่มี TOTP ในตัว"],
          ].map(([app, desc]) => (
            <div key={app} className="flex justify-between gap-4 py-1.5 border-b border-border-default last:border-0">
              <span className="font-medium text-text-primary">{app}</span>
              <span className="text-right">{desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
