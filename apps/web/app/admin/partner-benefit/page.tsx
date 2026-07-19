"use client";

import { useState } from "react";

const PAGE_URL = "https://zudobot.zudogu.com/partner-benefit";

type ShareMode = "link" | "email";

export default function AdminPartnerBenefitPage() {
  const [mode, setMode]       = useState<ShareMode>("link");
  const [copied, setCopied]   = useState(false);
  const [emails, setEmails]   = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult]   = useState<{ sent?: number; failed?: string[]; error?: string } | null>(null);

  async function handleCopy() {
    await navigator.clipboard.writeText(PAGE_URL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleSendEmail(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
    const list = emails.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
    if (list.length === 0) return;

    setSending(true);
    try {
      const res  = await fetch("/api/admin/partner-benefit/share", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ emails: list }),
      });
      const data = await res.json();
      if (!res.ok) setResult({ error: data.error ?? "เกิดข้อผิดพลาด" });
      else         setResult({ sent: data.sent, failed: data.failed });
    } catch {
      setResult({ error: "เกิดข้อผิดพลาด กรุณาลองใหม่" });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-heading font-bold text-text-primary">Partner Benefit</h1>
        <p className="text-sm text-text-muted mt-1">
          แชร์หน้า Partner Program ให้คนที่คุณต้องการเชิญมาเป็น Partner
        </p>
      </div>

      {/* Page preview link */}
      <div className="card-premium p-5 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs text-text-muted mb-0.5">URL ของหน้า Partner Benefit</p>
          <p className="text-sm font-medium text-brand-600 truncate">{PAGE_URL}</p>
        </div>
        <a
          href={PAGE_URL}
          target="_blank"
          rel="noreferrer"
          className="flex-shrink-0 px-3 py-1.5 rounded-lg border border-border-default text-xs font-medium text-text-secondary hover:bg-surface-secondary transition-colors"
        >
          เปิดดู ↗
        </a>
      </div>

      {/* Share mode tabs */}
      <div className="card-premium p-6 space-y-5">
        <div className="flex gap-2">
          <button
            onClick={() => { setMode("link"); setResult(null); }}
            className={[
              "flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors border",
              mode === "link"
                ? "bg-brand-600 text-white border-brand-600"
                : "bg-surface-secondary text-text-secondary border-border-default hover:border-brand-300",
            ].join(" ")}
          >
            🔗 แชร์ให้ทุกคนที่มีลิงก์
          </button>
          <button
            onClick={() => { setMode("email"); setResult(null); }}
            className={[
              "flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors border",
              mode === "email"
                ? "bg-brand-600 text-white border-brand-600"
                : "bg-surface-secondary text-text-secondary border-border-default hover:border-brand-300",
            ].join(" ")}
          >
            ✉️ แชร์ให้อีเมล์เฉพาะ
          </button>
        </div>

        {/* ── Mode: Copy Link ── */}
        {mode === "link" && (
          <div className="space-y-3">
            <p className="text-sm text-text-secondary">
              หน้านี้เปิดสาธารณะ — ใครก็ตามที่มีลิงก์สามารถดูได้ทันที
            </p>
            <div className="flex gap-2">
              <input
                readOnly
                value={PAGE_URL}
                className="flex-1 bg-surface-secondary border border-border-default rounded-xl px-4 py-2.5 text-sm text-text-primary font-mono"
              />
              <button
                onClick={handleCopy}
                className={[
                  "px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors",
                  copied
                    ? "bg-green-600 text-white"
                    : "bg-brand-600 hover:bg-brand-700 text-white",
                ].join(" ")}
              >
                {copied ? "✓ คัดลอกแล้ว" : "คัดลอกลิงก์"}
              </button>
            </div>
          </div>
        )}

        {/* ── Mode: Email ── */}
        {mode === "email" && (
          <form onSubmit={handleSendEmail} className="space-y-3">
            <p className="text-sm text-text-secondary">
              กรอกอีเมล์ที่ต้องการส่งลิงก์ให้ (คั่นด้วย Enter หรือ , สูงสุด 50 อีเมล์)
            </p>
            <textarea
              value={emails}
              onChange={(e) => { setEmails(e.target.value); setResult(null); }}
              placeholder={"example@gmail.com\nanother@company.com"}
              rows={5}
              className="w-full bg-surface-secondary border border-border-default rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-400 transition-colors resize-none font-mono"
            />
            <button
              type="submit"
              disabled={sending || !emails.trim()}
              className="w-full py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  กำลังส่ง...
                </span>
              ) : "ส่งอีเมล์"}
            </button>

            {/* Result */}
            {result && !result.error && (
              <div className="px-4 py-3 rounded-xl bg-green-50 border border-green-200 text-sm text-green-800">
                ส่งสำเร็จ {result.sent} อีเมล์
                {result.failed && result.failed.length > 0 && (
                  <span className="text-red-600 ml-2">
                    (ล้มเหลว: {result.failed.join(", ")})
                  </span>
                )}
              </div>
            )}
            {result?.error && (
              <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
                {result.error}
              </div>
            )}
          </form>
        )}
      </div>

      {/* Info */}
      <div className="card-premium p-5 bg-surface-secondary space-y-2">
        <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">ข้อมูลหน้า Partner Benefit</p>
        <div className="grid grid-cols-2 gap-3 text-sm">
          {[
            ["Gross Margin", "45% ทุกเดือน"],
            ["กำไรสูงสุด", "฿6,745/เดือน/ลูกค้า"],
            ["ค่าสมัคร", "ฟรี"],
            ["รับเงินผ่าน", "Stripe Connect"],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between items-center bg-surface-primary rounded-lg px-3 py-2">
              <span className="text-text-muted text-xs">{k}</span>
              <span className="font-semibold text-text-primary text-xs">{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
