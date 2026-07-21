"use client";

import { useCallback, useEffect, useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

type LogCategory = "auth" | "bot_state" | "admin_action" | "payment";

interface SystemLogEntry {
  _id:         string;
  category:    LogCategory;
  email?:      string;
  actorEmail?: string;
  action:      string;
  details?:    Record<string, unknown>;
  ip?:         string;
  createdAt:   string;
}

interface ApiResponse {
  stats: { byCategory: Record<string, number>; total: number };
  total: number;
  page:  number;
  limit: number;
  logs:  SystemLogEntry[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const CATEGORY_STYLE: Record<LogCategory, string> = {
  auth:         "bg-blue-100    text-blue-800    border-blue-200",
  bot_state:    "bg-amber-100   text-amber-800   border-amber-200",
  admin_action: "bg-purple-100  text-purple-800  border-purple-200",
  payment:      "bg-emerald-100 text-emerald-800 border-emerald-200",
};

const CATEGORY_LABEL: Record<LogCategory, string> = {
  auth:         "Auth",
  bot_state:    "Bot State",
  admin_action: "Admin Action",
  payment:      "Payment",
};

function CategoryBadge({ category }: { category: LogCategory }) {
  return (
    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${CATEGORY_STYLE[category]}`}>
      {CATEGORY_LABEL[category]}
    </span>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="rounded-xl border border-border-default bg-white p-5 shadow-sm">
      <p className="text-xs text-text-muted uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-3xl font-extrabold ${accent ?? "text-text-primary"}`}>{value}</p>
    </div>
  );
}

const PAGE_SIZE = 50;

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SystemLogPage() {
  const [data,     setData]     = useState<ApiResponse | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [email,    setEmail]    = useState("");
  const [category, setCategory] = useState<LogCategory | "">("");
  const [from,     setFrom]     = useState("");
  const [to,       setTo]       = useState("");
  const [page,     setPage]     = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (email)    params.set("email", email);
      if (category) params.set("category", category);
      if (from)     params.set("from", new Date(from).toISOString());
      if (to)       params.set("to", new Date(to).toISOString());

      const res = await fetch(`/api/admin/system-log?${params.toString()}`);
      if (!res.ok) throw new Error(await res.text());
      setData(await res.json() as ApiResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  }, [email, category, from, to, page]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">System Log</h1>
          <p className="text-sm text-text-muted mt-0.5">
            ประวัติเหตุการณ์ทุกขั้นตอนของทุกอีเมล์ในระบบ — auth / bot state / admin action / payment
          </p>
        </div>
        <button
          onClick={() => void fetchData()}
          disabled={loading}
          className="px-4 py-2 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 disabled:opacity-50"
        >
          {loading ? "กำลังโหลด..." : "🔄 Refresh"}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center bg-white border border-border-default rounded-xl p-4">
        <input
          type="text"
          placeholder="ค้นหาอีเมล์..."
          value={email}
          onChange={(e) => { setEmail(e.target.value); setPage(1); }}
          className="text-sm border border-border-default rounded-lg px-3 py-1.5 w-56"
        />
        <select
          value={category}
          onChange={(e) => { setCategory(e.target.value as LogCategory | ""); setPage(1); }}
          className="text-sm border border-border-default rounded-lg px-2 py-1.5"
        >
          <option value="">ทุกหมวด</option>
          <option value="auth">Auth</option>
          <option value="bot_state">Bot State</option>
          <option value="admin_action">Admin Action</option>
          <option value="payment">Payment</option>
        </select>
        <div className="flex items-center gap-2">
          <label className="text-xs text-text-muted font-medium">จาก</label>
          <input
            type="date"
            value={from}
            onChange={(e) => { setFrom(e.target.value); setPage(1); }}
            className="text-sm border border-border-default rounded-lg px-2 py-1"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-text-muted font-medium">ถึง</label>
          <input
            type="date"
            value={to}
            onChange={(e) => { setTo(e.target.value); setPage(1); }}
            className="text-sm border border-border-default rounded-lg px-2 py-1"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Stats cards */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Auth" value={data.stats.byCategory.auth ?? 0} />
          <StatCard label="Bot State" value={data.stats.byCategory.bot_state ?? 0} accent="text-amber-600" />
          <StatCard label="Admin Action" value={data.stats.byCategory.admin_action ?? 0} accent="text-purple-600" />
          <StatCard label="Payment" value={data.stats.byCategory.payment ?? 0} accent="text-emerald-600" />
        </div>
      )}

      {/* Log table */}
      <div className="rounded-xl border border-border-default bg-white overflow-hidden shadow-sm">
        <div className="px-5 py-3 border-b border-border-default flex items-center justify-between">
          <p className="text-sm font-semibold text-text-primary">
            Event Log{data ? ` — ${data.total.toLocaleString("th-TH")} รายการ` : ""}
          </p>
          {data && data.total > PAGE_SIZE && (
            <div className="flex items-center gap-2 text-sm">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1 rounded-lg border border-border-default disabled:opacity-40 hover:bg-surface-secondary"
              >
                ← ก่อนหน้า
              </button>
              <span className="text-text-muted">หน้า {page} / {totalPages}</span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1 rounded-lg border border-border-default disabled:opacity-40 hover:bg-surface-secondary"
              >
                ถัดไป →
              </button>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-secondary text-xs text-text-muted uppercase">
              <tr>
                <th className="px-4 py-2 text-left">เวลา</th>
                <th className="px-4 py-2 text-center">หมวด</th>
                <th className="px-4 py-2 text-left">อีเมล์</th>
                <th className="px-4 py-2 text-left">ผู้ดำเนินการ</th>
                <th className="px-4 py-2 text-left">Action</th>
                <th className="px-4 py-2 text-left">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-default">
              {loading && !data && (
                <tr><td colSpan={6} className="py-10 text-center text-text-muted">กำลังโหลด...</td></tr>
              )}
              {!loading && data?.logs.length === 0 && (
                <tr><td colSpan={6} className="py-10 text-center text-text-muted">ยังไม่มีข้อมูล</td></tr>
              )}
              {data?.logs.map((log) => {
                const detailsStr = log.details ? JSON.stringify(log.details) : "";
                const isExpanded = expanded === log._id;
                return (
                  <tr key={log._id} className="hover:bg-surface-secondary/50 transition-colors align-top">
                    <td className="px-4 py-2 text-text-muted whitespace-nowrap text-xs">
                      {new Date(log.createdAt).toLocaleString("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit", day: "2-digit", month: "2-digit" })}
                    </td>
                    <td className="px-4 py-2 text-center"><CategoryBadge category={log.category} /></td>
                    <td className="px-4 py-2 text-text-primary max-w-[200px] truncate">{log.email ?? "—"}</td>
                    <td className="px-4 py-2 text-text-muted max-w-[180px] truncate">{log.actorEmail ?? "—"}</td>
                    <td className="px-4 py-2 font-mono text-xs text-text-primary">{log.action}</td>
                    <td className="px-4 py-2 max-w-[320px]">
                      {detailsStr ? (
                        <button
                          onClick={() => setExpanded(isExpanded ? null : log._id)}
                          className="text-left w-full"
                        >
                          <span className={`font-mono text-xs text-text-muted ${isExpanded ? "" : "truncate block"}`}>
                            {detailsStr}
                          </span>
                        </button>
                      ) : <span className="text-text-muted">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
