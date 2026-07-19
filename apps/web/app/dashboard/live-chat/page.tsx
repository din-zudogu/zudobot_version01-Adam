"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface Session {
  sessionId:    string;
  botStatus:    "handoff_pending" | "handoff_active" | "paused" | "bot" | "resolved";
  handoffAt:    string | null;
  lastActiveAt: string | null;
  lastMessage:  string;
  messageCount: number;
  sentiment?:   number;
  intent?:      string;
}

interface Counts { pending: number; active: number; total: number; }

const STATUS_META: Record<string, { label: string; dot: string; ring: string }> = {
  handoff_pending: { label: "รอรับ",       dot: "bg-amber-400",  ring: "border-amber-300" },
  handoff_active:  { label: "กำลังดูแล",   dot: "bg-green-500",  ring: "border-green-300" },
  paused:          { label: "บอทหยุดชั่วคราว", dot: "bg-blue-500", ring: "border-blue-300" },
};

function sentimentLabel(s?: number): { text: string; color: string } | null {
  if (s === undefined) return null;
  if (s <= 2)  return { text: "😊 พอใจ",      color: "text-green-600"  };
  if (s <= 5)  return { text: "😐 เฉยๆ",       color: "text-yellow-600" };
  if (s <= 7)  return { text: "😤 หงุดหงิด",   color: "text-orange-600" };
  if (s <= 9)  return { text: "😠 โกรธ",        color: "text-red-600"    };
  return             { text: "🚨 วิกฤต",        color: "text-red-700 font-bold" };
}

function relTime(iso: string | null): string {
  if (!iso) return "";
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)   return `${diff}s ที่แล้ว`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ที่แล้ว`;
  return `${Math.floor(diff / 3600)}h ที่แล้ว`;
}

function Spinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function LiveChatInboxPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [counts,   setCounts]   = useState<Counts>({ pending: 0, active: 0, total: 0 });
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState<"all" | "handoff_pending" | "handoff_active" | "paused">("all");
  const [lastRefresh, setLastRefresh] = useState(Date.now());

  const load = useCallback(async () => {
    try {
      const url = filter === "all"
        ? "/api/tenant/live-chat"
        : `/api/tenant/live-chat?status=${filter}`;
      const res  = await fetch(url);
      const data = await res.json() as { sessions?: Session[]; counts?: Counts };
      setSessions(data.sessions ?? []);
      setCounts(data.counts ?? { pending: 0, active: 0, total: 0 });
    } catch { /* ignore */ }
    finally {
      setLoading(false);
      setLastRefresh(Date.now());
    }
  }, [filter]);

  // Initial load + poll every 10 s
  useEffect(() => {
    setLoading(true);
    load();
    const interval = setInterval(load, 10_000);
    return () => clearInterval(interval);
  }, [load]);

  const displayed = filter === "all"
    ? sessions
    : sessions.filter((s) => s.botStatus === filter);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-text-primary">Live Chat Inbox</h1>
          <p className="text-sm text-text-muted mt-0.5">
            Session ที่ลูกค้าขอคุยกับเจ้าหน้าที่ — อัปเดตทุก 10 วินาที
          </p>
        </div>
        <button
          onClick={() => load()}
          className="text-xs px-3 py-1.5 rounded-lg border border-border-default bg-surface-secondary hover:border-brand-400 hover:text-brand-600 transition-colors"
        >
          ↻ รีเฟรช
        </button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "รอรับ",       value: counts.pending, color: "text-amber-600",  bg: "bg-amber-50 border-amber-200" },
          { label: "กำลังดูแล",   value: counts.active,  color: "text-green-600",  bg: "bg-green-50 border-green-200" },
          { label: "ทั้งหมด",     value: counts.total,   color: "text-text-primary", bg: "card-premium" },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`${bg} border rounded-xl p-3 text-center`}>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-text-muted mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {([
          { key: "all",             label: "ทั้งหมด" },
          { key: "handoff_pending", label: "รอรับ" },
          { key: "handoff_active",  label: "กำลังดูแล" },
          { key: "paused",          label: "บอทหยุดชั่วคราว" },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
              filter === key
                ? "bg-brand-600 text-white border-brand-600"
                : "bg-surface-secondary border-border-default text-text-secondary hover:border-brand-400"
            }`}
          >
            {label}
          </button>
        ))}
        <span className="ml-auto text-xs text-text-muted self-center">
          อัปเดตล่าสุด {relTime(new Date(lastRefresh).toISOString())}
        </span>
      </div>

      {/* Session list */}
      {loading ? (
        <Spinner />
      ) : displayed.length === 0 ? (
        <div className="card-premium p-12 text-center">
          <p className="text-4xl mb-3">💬</p>
          <p className="text-text-muted text-sm">ไม่มี session ที่ต้องดูแลในขณะนี้</p>
          <p className="text-xs text-text-muted mt-1">เมื่อลูกค้าขอคุยกับเจ้าหน้าที่ จะปรากฏที่นี่</p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayed.map((s) => {
            const meta = STATUS_META[s.botStatus] ?? STATUS_META.handoff_pending;
            const sent = sentimentLabel(s.sentiment);

            return (
              <Link
                key={s.sessionId}
                href={`/dashboard/live-chat/${s.sessionId}`}
                className={`card-premium p-4 flex items-start gap-4 hover:border-brand-400 transition-colors border-2 ${meta.ring} block`}
              >
                {/* Status dot */}
                <div className="flex-shrink-0 mt-1">
                  <span className={`inline-block w-3 h-3 rounded-full ${meta.dot} animate-pulse`} />
                </div>

                {/* Main content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono text-text-muted">
                      {s.sessionId.slice(0, 8)}…
                    </span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      s.botStatus === "handoff_pending"
                        ? "bg-amber-100 text-amber-700"
                        : s.botStatus === "handoff_active"
                        ? "bg-green-100 text-green-700"
                        : "bg-blue-100 text-blue-700"
                    }`}>
                      {meta.label}
                    </span>
                    {sent && (
                      <span className={`text-xs ${sent.color}`}>{sent.text}</span>
                    )}
                    {s.intent && (
                      <span className="text-xs bg-surface-secondary text-text-muted px-2 py-0.5 rounded-full">
                        {s.intent}
                      </span>
                    )}
                  </div>

                  <p className="text-sm text-text-primary mt-1.5 truncate">
                    {s.lastMessage || <span className="text-text-muted italic">ไม่มีข้อความ</span>}
                  </p>

                  <div className="flex items-center gap-3 mt-1.5 text-xs text-text-muted">
                    <span>{s.messageCount} ข้อความ</span>
                    {s.handoffAt && <span>ขอเจ้าหน้าที่ {relTime(s.handoffAt)}</span>}
                    {s.lastActiveAt && <span>ใช้งานล่าสุด {relTime(s.lastActiveAt)}</span>}
                  </div>
                </div>

                <div className="flex-shrink-0 text-text-muted text-sm">›</div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
