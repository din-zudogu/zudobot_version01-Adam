"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";

interface Notification {
  _id:       string;
  type:      string;
  title:     string;
  message:   string;
  isRead:    boolean;
  actionUrl?: string;
  createdAt: string;
}

const TYPE_ICON: Record<string, string> = {
  quota_alert_80:     "📊",
  quota_alert_95:     "⚠️",
  quota_exhausted:    "🚫",
  quota_suspended:    "🚫",
  trial_expiry_3days: "⏰",
  trial_expired:      "⌛",
  payment_success:    "✅",
  payment_failed:     "💳",
  payment_grace:      "💳",
  retention_warning:  "🗂",
  memory_warning:     "💾",
  kyc_approved:       "✅",
  kyc_rejected:       "❌",
  plan_upgraded:      "🚀",
  system_announcement:"📢",
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60_000);
  if (mins < 1)   return "เมื่อกี้";
  if (mins < 60)  return `${mins} นาทีที่แล้ว`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs} ชั่วโมงที่แล้ว`;
  return `${Math.floor(hrs / 24)} วันที่แล้ว`;
}

export function NotificationBell() {
  const [open, setOpen]             = useState(false);
  const [notifications, setNots]    = useState<Notification[]>([]);
  const [unread, setUnread]         = useState(0);
  const ref                         = useRef<HTMLDivElement>(null);

  const fetchNots = useCallback(async () => {
    try {
      const res = await fetch("/api/tenant/notifications?limit=8");
      if (!res.ok) return;
      const data = await res.json();
      setNots(data.notifications ?? []);
      setUnread(data.unreadCount ?? 0);
    } catch { /* silent */ }
  }, []);

  // Initial fetch + poll every 60s
  useEffect(() => {
    void fetchNots();
    const id = setInterval(() => { void fetchNots(); }, 60_000);
    return () => clearInterval(id);
  }, [fetchNots]);

  // Click outside to close
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  async function markAllRead() {
    await fetch("/api/tenant/notifications/read-all", { method: "PUT" });
    setNots((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnread(0);
  }

  return (
    <div ref={ref} className="relative">
      {/* Bell button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative w-8 h-8 flex items-center justify-center rounded-xl hover:bg-surface-secondary transition-colors text-text-secondary hover:text-text-primary"
        aria-label="การแจ้งเตือน"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-10 w-80 bg-surface-primary border border-border-default rounded-2xl shadow-card z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border-default">
            <span className="text-sm font-semibold text-text-primary">การแจ้งเตือน</span>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-xs text-brand-600 hover:underline font-medium">
                อ่านทั้งหมด
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-border-default">
            {notifications.length === 0 ? (
              <p className="text-center py-8 text-sm text-text-muted">ไม่มีการแจ้งเตือน</p>
            ) : (
              notifications.map((n) => {
                const inner = (
                  <div className={[
                    "flex gap-3 px-4 py-3 transition-colors hover:bg-surface-secondary",
                    !n.isRead ? "bg-brand-50/60" : "",
                  ].join(" ")}>
                    <span className="text-lg mt-0.5 flex-shrink-0">{TYPE_ICON[n.type] ?? "🔔"}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm leading-snug ${!n.isRead ? "font-semibold text-text-primary" : "text-text-secondary"}`}>
                        {n.title}
                      </p>
                      <p className="text-xs text-text-muted mt-0.5 line-clamp-2">{n.message}</p>
                      <p className="text-[10px] text-text-muted mt-1">{timeAgo(n.createdAt)}</p>
                    </div>
                    {!n.isRead && <span className="w-2 h-2 rounded-full bg-brand-500 flex-shrink-0 mt-1.5" />}
                  </div>
                );
                return n.actionUrl ? (
                  <Link key={n._id} href={n.actionUrl} onClick={() => setOpen(false)}>{inner}</Link>
                ) : (
                  <div key={n._id}>{inner}</div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
