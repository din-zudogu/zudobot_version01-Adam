"use client";

import { useState, useEffect, useCallback } from "react";

interface Announcement {
  _id:            string;
  title:          string;
  message:        string;
  actionUrl?:     string;
  recipientCount: number;
  createdAt:      string;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleString("th-TH", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading]             = useState(true);
  const [sending, setSending]             = useState(false);
  const [error, setError]                 = useState("");
  const [success, setSuccess]             = useState("");

  const [title,     setTitle]     = useState("");
  const [message,   setMessage]   = useState("");
  const [actionUrl, setActionUrl] = useState("");

  const loadAnnouncements = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/announcements");
      const d   = await res.json();
      if (!d.error) setAnnouncements(d.announcements ?? []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadAnnouncements(); }, [loadAnnouncements]);

  async function handleBroadcast(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!title.trim() || !message.trim()) {
      setError("กรุณากรอก Title และ Message");
      return;
    }
    setSending(true);
    try {
      const res  = await fetch("/api/admin/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ title: title.trim(), message: message.trim(), actionUrl: actionUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "เกิดข้อผิดพลาด"); return; }
      setSuccess(`ส่งแล้ว ${data.recipientCount} บัญชี`);
      setTitle(""); setMessage(""); setActionUrl("");
      void loadAnnouncements();
    } catch {
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-bold text-text-primary">Announcements</h1>
        <p className="text-sm text-text-muted mt-0.5">ส่งการแจ้งเตือนไปยัง Tenant ทุกรายพร้อมกัน</p>
      </div>

      {/* Broadcast form */}
      <div className="bg-surface-primary rounded-2xl border border-border-default p-5">
        <p className="text-sm font-semibold text-text-primary mb-4">Broadcast ใหม่</p>

        <form onSubmit={handleBroadcast} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="เช่น ประกาศอัปเดตระบบ"
              className="w-full rounded-xl border border-border-default bg-surface-secondary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">
              Message <span className="text-red-500">*</span>
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder="รายละเอียดข้อความที่จะส่งไปยัง Tenant ทุกราย"
              className="w-full rounded-xl border border-border-default bg-surface-secondary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">
              Action URL <span className="text-text-muted font-normal">(optional)</span>
            </label>
            <input
              value={actionUrl}
              onChange={(e) => setActionUrl(e.target.value)}
              placeholder="/pricing หรือ https://..."
              className="w-full rounded-xl border border-border-default bg-surface-secondary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          {error   && <p className="text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2">{error}</p>}
          {success && <p className="text-xs text-green-600 bg-green-50 rounded-xl px-3 py-2">{success}</p>}

          <button
            type="submit"
            disabled={sending}
            className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 transition-colors disabled:opacity-50"
          >
            {sending ? "กำลังส่ง..." : "Broadcast ทันที"}
          </button>
        </form>
      </div>

      {/* History */}
      <div className="bg-surface-primary rounded-2xl border border-border-default p-5">
        <p className="text-sm font-semibold text-text-primary mb-4">ประวัติการส่ง (20 ล่าสุด)</p>

        {loading ? (
          <p className="text-xs text-text-muted animate-pulse">กำลังโหลด...</p>
        ) : announcements.length === 0 ? (
          <p className="text-sm text-text-muted">ยังไม่มีประวัติ</p>
        ) : (
          <div className="space-y-3">
            {announcements.map((a) => (
              <div
                key={a._id}
                className="rounded-xl border border-border-default p-4 hover:bg-surface-secondary transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-text-primary leading-snug">{a.title}</p>
                    <p className="text-xs text-text-secondary mt-0.5 line-clamp-2">{a.message}</p>
                    {a.actionUrl && (
                      <p className="text-xs text-brand-600 mt-0.5 truncate">{a.actionUrl}</p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="inline-block text-[10px] font-semibold bg-green-100 text-green-700 rounded-full px-2 py-0.5">
                      {a.recipientCount} คน
                    </span>
                    <p className="text-[10px] text-text-muted mt-1">{fmtDate(a.createdAt)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
