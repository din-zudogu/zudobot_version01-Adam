"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────

interface Notification {
  _id:       string;
  type:      string;
  title:     string;
  message:   string;
  isRead:    boolean;
  actionUrl?: string;
  createdAt: string;
}

interface LineStatus {
  tenantId:         string;
  lineEnabled:      boolean;
  hasChannelToken:  boolean;
  hasChannelSecret: boolean;
  hasUserId:        boolean;
  lineConnectCode:  string;
  embedKey:         string;
  tokenPreview:     string | null;
  userIdPreview:    string | null;
}

// ── Constants ─────────────────────────────────────────────────────────────

const TYPE_ICON: Record<string, string> = {
  quota_alert_80:      "📊",
  quota_alert_95:      "⚠️",
  quota_exhausted:     "🚫",
  quota_suspended:     "🚫",
  trial_quota_daily:   "📊",
  trial_expiry_3days:  "⏰",
  trial_expired:       "⌛",
  payment_success:     "✅",
  payment_failed:      "💳",
  payment_suspended:   "💳",
  retention_warning:   "🗂",
  memory_full:         "💾",
  kyc_approved:        "✅",
  kyc_rejected:        "❌",
  plan_upgraded:       "🚀",
  system_announcement: "📢",
};

function timeAgo(d: string) {
  const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60_000);
  if (mins < 1)   return "เมื่อกี้";
  if (mins < 60)  return `${mins} นาทีที่แล้ว`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs} ชั่วโมงที่แล้ว`;
  return `${Math.floor(hrs / 24)} วันที่แล้ว`;
}

// ── Step indicator ────────────────────────────────────────────────────────

function StepBadge({ n, done, active }: { n: number; done: boolean; active: boolean }) {
  return (
    <div className={[
      "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-colors",
      done   ? "bg-green-500 text-white" :
      active ? "bg-brand-600 text-white" :
               "bg-surface-tertiary text-text-muted border border-border-default",
    ].join(" ")}>
      {done ? "✓" : n}
    </div>
  );
}

// ── 3-Step Magic Connect section ──────────────────────────────────────────

function LineConnectSection() {
  const [status, setStatus]         = useState<LineStatus | null>(null);
  const [step, setStep]             = useState<1 | 2 | 3>(1);
  const [channelSecret, setSecret]  = useState("");
  const [channelToken, setToken]    = useState("");
  const [saving, setSaving]         = useState(false);
  const [testing, setTesting]       = useState(false);
  const [disconnecting, setDisc]    = useState(false);
  const [copied, setCopied]         = useState(false);
  const [polling, setPolling]       = useState(false);
  const [msg, setMsg]               = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/tenant/line-notify");
      if (res.ok) {
        const d = await res.json() as LineStatus;
        setStatus(d);
        // Determine current step
        if (d.hasUserId) {
          setStep(3);
        } else if (d.hasChannelToken && d.hasChannelSecret) {
          setStep(2);
        } else {
          setStep(1);
        }
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Poll for userId capture while on step 3 (connect code step)
  useEffect(() => {
    if (step !== 3 || !status?.lineConnectCode || status.hasUserId) return;
    setPolling(true);
    const interval = setInterval(async () => {
      const res = await fetch("/api/tenant/line-notify").catch(() => null);
      if (!res?.ok) return;
      const d = await res.json() as LineStatus;
      setStatus(d);
      if (d.hasUserId) {
        setStep(3);
        setPolling(false);
        clearInterval(interval);
      }
    }, 3000);
    return () => { clearInterval(interval); setPolling(false); };
  }, [step, status?.lineConnectCode, status?.hasUserId]);

  function flash(type: "ok" | "err", text: string) {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 5000);
  }

  async function handleSaveCredentials() {
    if (!channelSecret.trim() || !channelToken.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/tenant/line-notify", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ lineChannelSecret: channelSecret.trim(), lineChannelToken: channelToken.trim() }),
      });
      if (!res.ok) throw new Error();
      setSecret("");
      setToken("");
      await load();
      setStep(2);
      flash("ok", "บันทึก API Keys สำเร็จ — ไปขั้นตอน 2");
    } catch {
      flash("err", "บันทึกไม่สำเร็จ กรุณาตรวจสอบข้อมูล");
    } finally {
      setSaving(false);
    }
  }

  async function handleCopy(text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleTest() {
    setTesting(true);
    try {
      const res = await fetch("/api/tenant/line-notify", { method: "POST" });
      const d   = await res.json() as { ok?: boolean; error?: string; lineStatus?: number };
      if (!res.ok) {
        const msg =
          d.error === "no_token"       ? "ยังไม่มี Channel Token" :
          d.error === "not_connected"  ? "ยังไม่ได้เชื่อมต่อ LINE — ทำ Step 3 ก่อน" :
          res.status === 401           ? "Token ไม่ถูกต้องหรือหมดอายุ" :
                                         `ส่งไม่สำเร็จ (LINE: ${d.lineStatus ?? res.status})`;
        flash("err", msg);
        return;
      }
      flash("ok", "ส่ง Test Alert ไปยัง LINE แล้ว ตรวจสอบโทรศัพท์ของคุณ ✓");
    } catch {
      flash("err", "ส่งไม่สำเร็จ — ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้");
    } finally {
      setTesting(false);
    }
  }

  async function handleDisconnect() {
    setDisc(true);
    try {
      const res = await fetch("/api/tenant/line-notify", { method: "DELETE" });
      if (!res.ok) throw new Error();
      await load();
      setStep(1);
      flash("ok", "ยกเลิกการเชื่อมต่อ LINE แล้ว");
    } catch {
      flash("err", "ยกเลิกไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setDisc(false);
    }
  }

  async function handleToggle() {
    if (!status) return;
    const res = await fetch("/api/tenant/line-notify", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ lineEnabled: !status.lineEnabled }),
    }).catch(() => null);
    if (res?.ok) await load();
  }

  if (!status) {
    return (
      <div className="card-premium p-5 mb-6 flex items-center justify-center h-24">
        <div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isConnected = status.hasUserId;
  const hasKeys     = status.hasChannelToken && status.hasChannelSecret;

  return (
    <div className="card-premium p-5 mb-6 space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center text-xl flex-shrink-0">
            💬
          </div>
          <div>
            <h2 className="font-semibold text-text-primary text-sm">LINE — แจ้งเตือน Human Handoff</h2>
            <p className="text-xs text-text-muted mt-0.5">
              รับการแจ้งเตือนบน LINE พร้อมลิงก์เข้าตอบลูกค้าได้ทันที
            </p>
          </div>
        </div>
        {isConnected && (
          <button
            onClick={handleToggle}
            className={[
              "relative flex-shrink-0 w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none",
              status.lineEnabled ? "bg-green-500" : "bg-gray-300",
            ].join(" ")}
            aria-label="Toggle LINE notification"
          >
            <span className={[
              "absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200",
              status.lineEnabled ? "translate-x-5" : "translate-x-0",
            ].join(" ")} />
          </button>
        )}
      </div>

      {/* Connected state */}
      {isConnected ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2.5">
            <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
            <span className="text-xs font-medium text-green-700 flex-1">เชื่อมต่อ LINE สำเร็จ — {status.userIdPreview}</span>
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${status.lineEnabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
              {status.lineEnabled ? "เปิดใช้งาน" : "ปิดใช้งาน"}
            </span>
          </div>
          <div className="text-[11px] text-text-muted">
            Channel Token: {status.tokenPreview}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleTest}
              disabled={testing || !status.lineEnabled}
              className="px-3 py-1.5 rounded-xl text-xs font-medium bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {testing ? "กำลังส่ง..." : "ทดสอบส่ง LINE"}
            </button>
            <button
              onClick={() => { setStep(1); }}
              className="px-3 py-1.5 rounded-xl text-xs font-medium border border-border-default text-text-secondary hover:bg-surface-secondary transition-colors"
            >
              เปลี่ยน API Keys
            </button>
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="px-3 py-1.5 rounded-xl text-xs font-medium text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              {disconnecting ? "กำลังยกเลิก..." : "ยกเลิกการเชื่อมต่อ"}
            </button>
          </div>
        </div>
      ) : (

        /* 3-Step Wizard */
        <div className="space-y-4">

          {/* Step 1 — API Keys */}
          <div className={`rounded-xl border p-4 space-y-3 transition-colors ${step === 1 ? "border-brand-300 bg-brand-50/40" : "border-border-default"}`}>
            <div className="flex items-center gap-3">
              <StepBadge n={1} done={hasKeys} active={step === 1} />
              <div>
                <p className="text-sm font-semibold text-text-primary">ตั้งค่า API Keys</p>
                <p className="text-xs text-text-muted">กรอก Channel Secret และ Channel Access Token จาก LINE Developers Console</p>
              </div>
            </div>

            {step === 1 && (
              <div className="space-y-2.5 pt-1">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">
                    Channel Secret
                    <a href="https://developers.line.biz/console/" target="_blank" rel="noopener noreferrer" className="ml-2 text-brand-600 hover:underline font-normal">(หาได้ที่ Basic settings)</a>
                  </label>
                  <input
                    type="password"
                    value={channelSecret}
                    onChange={(e) => setSecret(e.target.value)}
                    placeholder="c648bfd2aa301f..."
                    className="w-full bg-surface-secondary border border-border-default rounded-xl px-3 py-2 text-sm font-mono text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">
                    Channel Access Token (long-lived)
                    <a href="https://developers.line.biz/console/" target="_blank" rel="noopener noreferrer" className="ml-2 text-brand-600 hover:underline font-normal">(หาได้ที่ Messaging API → Channel access token)</a>
                  </label>
                  <input
                    type="password"
                    value={channelToken}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="xVuMIBfc89jlcEb..."
                    className="w-full bg-surface-secondary border border-border-default rounded-xl px-3 py-2 text-sm font-mono text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-400"
                  />
                </div>
                <button
                  onClick={handleSaveCredentials}
                  disabled={saving || !channelSecret.trim() || !channelToken.trim()}
                  className="w-full py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  {saving ? "กำลังบันทึก..." : "บันทึกและไปขั้นตอน 2 →"}
                </button>
              </div>
            )}

            {step > 1 && hasKeys && (
              <p className="text-xs text-green-700">✓ บันทึก API Keys แล้ว (Token: {status.tokenPreview})</p>
            )}
          </div>

          {/* Step 2 — Webhook Setup */}
          <div className={`rounded-xl border p-4 space-y-3 transition-colors ${step === 2 ? "border-brand-300 bg-brand-50/40" : "border-border-default opacity-60"}`}>
            <div className="flex items-center gap-3">
              <StepBadge n={2} done={false} active={step === 2} />
              <div>
                <p className="text-sm font-semibold text-text-primary">ตั้งค่า Webhook URL</p>
                <p className="text-xs text-text-muted">คัดลอก URL นี้ไปวางใน LINE Developers Console → Webhook URL</p>
              </div>
            </div>

            {step === 2 && (
              <div className="space-y-2.5 pt-1">
                <div className="flex items-center gap-2 bg-surface-secondary border border-border-default rounded-xl px-3 py-2">
                  <code className="text-xs text-text-primary flex-1 break-all font-mono">
                    {`${process.env.NEXT_PUBLIC_APP_URL ?? "https://zudobot.zudogu.com"}/api/webhooks/line/${status.tenantId}`}
                  </code>
                  <button
                    onClick={() => handleCopy(`${process.env.NEXT_PUBLIC_APP_URL ?? "https://zudobot.zudogu.com"}/api/webhooks/line/${status.tenantId}`)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-brand-600 text-white hover:bg-brand-700 transition-colors flex-shrink-0"
                  >
                    {copied ? "คัดลอกแล้ว ✓" : "คัดลอก"}
                  </button>
                </div>
                <p className="text-xs text-text-muted">
                  วาง URL นี้ใน LINE Developers Console → Messaging API → Webhook URL<br/>
                  กด <strong>Verify</strong> และเปิด <strong>Use webhook</strong> ให้เรียบร้อย
                </p>
                <button
                  onClick={() => setStep(3)}
                  className="w-full py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition-colors"
                >
                  ตั้งค่า Webhook แล้ว → ไปขั้นตอน 3
                </button>
              </div>
            )}
          </div>

          {/* Step 3 — Auto-Capture User ID */}
          <div className={`rounded-xl border p-4 space-y-3 transition-colors ${step === 3 ? "border-brand-300 bg-brand-50/40" : "border-border-default opacity-60"}`}>
            <div className="flex items-center gap-3">
              <StepBadge n={3} done={false} active={step === 3} />
              <div>
                <p className="text-sm font-semibold text-text-primary">ผูกบัญชี LINE อัตโนมัติ</p>
                <p className="text-xs text-text-muted">ส่งรหัสด้านล่างหา LINE OA ของคุณ ระบบจะเชื่อมต่ออัตโนมัติ</p>
              </div>
            </div>

            {step === 3 && status.lineConnectCode && (
              <div className="space-y-3 pt-1">
                <ol className="text-xs text-text-secondary space-y-1 list-decimal list-inside">
                  <li>เพิ่ม LINE OA ของคุณเป็นเพื่อน (ถ้ายังไม่ได้เพิ่ม)</li>
                  <li>ส่งข้อความนี้ไปยัง LINE OA ของคุณ:</li>
                </ol>

                <div className="flex items-center gap-2 bg-surface-secondary border-2 border-brand-200 rounded-xl px-4 py-3">
                  <code className="text-base font-bold text-brand-700 flex-1 tracking-widest">
                    {status.lineConnectCode}
                  </code>
                  <button
                    onClick={() => handleCopy(status.lineConnectCode)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-brand-600 text-white hover:bg-brand-700 transition-colors flex-shrink-0"
                  >
                    {copied ? "คัดลอกแล้ว ✓" : "คัดลอก"}
                  </button>
                </div>

                <div className="flex items-center gap-2 text-xs text-text-muted">
                  {polling && (
                    <><div className="w-3.5 h-3.5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                    <span>กำลังรอการเชื่อมต่อ...</span></>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Flash message */}
      {msg && (
        <div className={`px-3 py-2 rounded-xl text-xs font-medium ${msg.type === "ok" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-600 border border-red-200"}`}>
          {msg.text}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const [items, setItems]         = useState<Notification[]>([]);
  const [unread, setUnread]       = useState(0);
  const [loading, setLoading]     = useState(true);
  const [clearing, setClearing]   = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/tenant/notifications?limit=50");
      const d   = await res.json();
      setItems(d.notifications ?? []);
      setUnread(d.unreadCount   ?? 0);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function markAllRead() {
    await fetch("/api/tenant/notifications/read-all", { method: "PUT" });
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnread(0);
  }

  async function clearAll() {
    setClearing(true);
    await fetch("/api/tenant/notifications", { method: "DELETE" });
    setItems([]);
    setUnread(0);
    setConfirmClear(false);
    setClearing(false);
  }

  return (
    <div className="space-y-4 max-w-2xl">
      {/* LINE 3-Step Connect */}
      <LineConnectSection />

      {/* In-app notifications */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">การแจ้งเตือนในแอป</h1>
          <p className="text-sm text-text-muted mt-0.5">
            {unread > 0 ? `${unread} รายการยังไม่ได้อ่าน` : "อ่านทั้งหมดแล้ว"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {unread > 0 && (
            <button
              onClick={markAllRead}
              className="text-xs font-medium text-brand-600 hover:underline"
            >
              อ่านทั้งหมด
            </button>
          )}
          {items.length > 0 && !confirmClear && (
            <button
              onClick={() => setConfirmClear(true)}
              className="text-xs text-text-muted hover:text-red-500 transition-colors"
            >
              ล้างทั้งหมด
            </button>
          )}
          {confirmClear && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-red-500">ยืนยัน?</span>
              <button
                onClick={clearAll}
                disabled={clearing}
                className="text-xs font-semibold text-red-500 hover:text-red-700"
              >
                {clearing ? "กำลังลบ..." : "ใช่"}
              </button>
              <button
                onClick={() => setConfirmClear(false)}
                className="text-xs text-text-muted hover:text-text-primary"
              >
                ยกเลิก
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="bg-surface-primary rounded-2xl border border-border-default overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <p className="text-sm text-text-muted animate-pulse">กำลังโหลด...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <span className="text-3xl">🔔</span>
            <p className="text-sm text-text-muted">ไม่มีการแจ้งเตือน</p>
          </div>
        ) : (
          <div className="divide-y divide-border-default">
            {items.map((n) => {
              const inner = (
                <div
                  className={[
                    "flex gap-3 px-5 py-4 transition-colors hover:bg-surface-secondary",
                    !n.isRead ? "bg-brand-50/60" : "",
                  ].join(" ")}
                >
                  <span className="text-xl mt-0.5 flex-shrink-0">{TYPE_ICON[n.type] ?? "🔔"}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-snug ${!n.isRead ? "font-semibold text-text-primary" : "text-text-secondary"}`}>
                      {n.title}
                    </p>
                    <p className="text-xs text-text-muted mt-0.5">{n.message}</p>
                    <p className="text-[10px] text-text-muted mt-1.5">{timeAgo(n.createdAt)}</p>
                  </div>
                  {!n.isRead && <span className="w-2 h-2 rounded-full bg-brand-500 flex-shrink-0 mt-2" />}
                </div>
              );

              return n.actionUrl ? (
                <Link key={n._id} href={n.actionUrl}>{inner}</Link>
              ) : (
                <div key={n._id}>{inner}</div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
