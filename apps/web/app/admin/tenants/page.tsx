"use client";

import { useState, useEffect, useCallback } from "react";
import { botStateLabel } from "@/lib/payment/botStateMachine";
import type { BotState } from "@/types";
import { DeleteAccountModal, type DeleteTarget } from "@/components/admin/DeleteAccountModal";

interface Tenant {
  id:                 string;
  email:              string;
  name:               string;
  botState:           BotState;
  trialEndsAt?:       string;
  onboardingComplete: boolean;
  createdAt:          string;
  planId:             string;
  subStatus:          string;
  readyPackageName:   string;
  businessName:       string;
  dailyMsgCount:      number;
  pendingDeleteAt?:   string | null;
  deletedByAdmin?:    boolean;
}

const STATE_COLORS: Record<string, string> = {
  trial:                      "bg-brand-100 text-brand-700",
  trial_quota_daily_exhausted:"bg-yellow-100 text-yellow-700",
  trial_expired:              "bg-orange-100 text-orange-700",
  active:                     "bg-green-100 text-green-700",
  grace_5pct:                 "bg-yellow-100 text-yellow-700",
  suspended_quota:            "bg-red-100 text-red-700",
  suspended_payment:          "bg-red-100 text-red-700",
  pending_kyc:                "bg-purple-100 text-purple-700",
  disabled:                   "bg-gray-100 text-gray-500",
};

const BOT_STATES: BotState[] = [
  "trial","trial_quota_daily_exhausted","trial_expired",
  "active","grace_5pct","suspended_quota","suspended_payment","pending_kyc","disabled",
];

function CopyableId({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="flex items-center gap-1 mt-0.5 group"
      title="คลิกเพื่อคัดลอก tenantId"
    >
      <code className="text-[10px] font-mono text-text-muted group-hover:text-brand-600 transition-colors truncate max-w-[140px]">
        {value}
      </code>
      <span className="text-[9px] text-text-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        {copied ? "✓" : "copy"}
      </span>
    </button>
  );
}

export default function AdminTenantsPage() {
  const [tenants,     setTenants]     = useState<Tenant[]>([]);
  const [total,       setTotal]       = useState(0);
  const [page,        setPage]        = useState(1);
  const [search,      setSearch]      = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [loading,     setLoading]     = useState(true);

  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [toast,        setToast]        = useState<{ msg: string; ok: boolean } | null>(null);

  const fetchTenants = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (search)      params.set("q", search);
    if (stateFilter) params.set("state", stateFilter);
    const res  = await fetch(`/api/admin/tenants?${params}`);
    const data = await res.json();
    setTenants(data.tenants ?? []);
    setTotal(data.total ?? 0);
    setLoading(false);
  }, [page, search, stateFilter]);

  useEffect(() => { void fetchTenants(); }, [fetchTenants]);

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  }

  async function handleRestore(t: Tenant) {
    try {
      const res = await fetch(`/api/admin/tenants/${t.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ action: "restore" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "server_error");
      showToast(`${t.email} — กู้คืนบัญชีสำเร็จ`);
      void fetchTenants();
    } catch {
      showToast("กู้คืนไม่สำเร็จ กรุณาลองใหม่", false);
    }
  }

  const totalPages = Math.ceil(total / 20);

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] px-5 py-3 rounded-2xl shadow-lg text-sm font-medium pointer-events-none ${
          toast.ok ? "bg-gray-900 text-white" : "bg-red-600 text-white"
        }`}>
          {toast.msg}
        </div>
      )}

      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-heading text-2xl font-bold text-text-primary">Tenants</h1>
          <p className="text-sm text-text-muted mt-0.5">ผู้ใช้ทั้งหมด {total.toLocaleString()} รายการ</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="ค้นหา email หรือชื่อ..."
          className="flex-1 min-w-48 bg-surface-primary border border-border-default rounded-xl px-3.5 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-400 transition-colors"
        />
        <select
          value={stateFilter}
          onChange={(e) => { setStateFilter(e.target.value); setPage(1); }}
          className="bg-surface-primary border border-border-default rounded-xl px-3.5 py-2 text-sm text-text-primary focus:outline-none focus:border-brand-400 transition-colors"
        >
          <option value="">ทุก State</option>
          {BOT_STATES.map((s) => (
            <option key={s} value={s}>{botStateLabel(s)}</option>
          ))}
        </select>
        <button
          onClick={() => void fetchTenants()}
          className="px-4 py-2 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors"
        >
          ค้นหา
        </button>
      </div>

      {/* Table */}
      <div className="bg-surface-primary rounded-2xl border border-border-default overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : tenants.length === 0 ? (
          <div className="text-center py-16 text-text-muted text-sm">ไม่พบผู้ใช้</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-default bg-surface-secondary">
                {["Tenant","ธุรกิจ","State","แพคเกจ / Plan","ข้อความวันนี้","สมัครเมื่อ","Actions"].map((h) => (
                  <th key={h} className={`text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wide ${h === "Actions" ? "text-right" : ""}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => {
                const isPendingDelete = !!t.pendingDeleteAt;
                const deletionDate   = isPendingDelete
                  ? new Date(t.pendingDeleteAt!).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" })
                  : null;

                return (
                  <tr
                    key={t.id}
                    className={`border-b border-border-default last:border-0 transition-colors ${
                      isPendingDelete ? "bg-red-50/40 hover:bg-red-50/60" : "hover:bg-surface-secondary/50"
                    }`}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-text-primary">{t.name}</p>
                      <p className="text-xs text-text-muted">{t.email}</p>
                      <CopyableId value={t.id} />
                      {!t.onboardingComplete && (
                        <span className="text-[10px] text-orange-500 font-medium">⚠ Onboarding incomplete</span>
                      )}
                      {isPendingDelete && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5 mt-1">
                          ⏳ รอลบถาวร {deletionDate}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{t.businessName || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block text-xs font-medium px-2.5 py-1 rounded-full ${STATE_COLORS[t.botState] ?? "bg-gray-100 text-gray-500"}`}>
                        {botStateLabel(t.botState)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {t.readyPackageName ? (
                        <span className="inline-block text-[11px] font-semibold text-brand-700 bg-brand-50 border border-brand-200 rounded-full px-2 py-0.5 mb-1">
                          📦 {t.readyPackageName}
                        </span>
                      ) : (
                        <span className="inline-block text-[11px] text-text-muted mb-1">— ไม่มีแพคเกจสำเร็จรูป —</span>
                      )}
                      <p className="text-xs font-medium text-text-primary capitalize">
                        แพลน: {t.planId}
                      </p>
                      <p className="text-xs text-text-muted">{t.subStatus}</p>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-text-secondary">
                      {t.dailyMsgCount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-xs text-text-muted whitespace-nowrap">
                      {new Date(t.createdAt).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isPendingDelete ? (
                        <button
                          onClick={() => handleRestore(t)}
                          className="text-xs px-3 py-1.5 rounded-lg border border-green-300 text-green-700 hover:bg-green-50 font-medium transition-colors whitespace-nowrap"
                        >
                          กู้คืนบัญชี
                        </button>
                      ) : (
                        <button
                          onClick={() => setDeleteTarget({ id: t.id, name: t.name, email: t.email, type: "tenant" })}
                          className="text-xs px-3 py-1.5 rounded-lg border border-red-300 text-red-600 hover:bg-red-50 font-medium transition-colors"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-text-muted">หน้า {page} / {totalPages}</p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 rounded-lg border border-border-default text-sm text-text-secondary hover:bg-surface-secondary disabled:opacity-40 transition-colors"
            >
              ← ก่อนหน้า
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 rounded-lg border border-border-default text-sm text-text-secondary hover:bg-surface-secondary disabled:opacity-40 transition-colors"
            >
              ถัดไป →
            </button>
          </div>
        </div>
      )}

      {/* Reusable 2-step delete modal */}
      {deleteTarget && (
        <DeleteAccountModal
          target={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onSuccess={(type) => {
            setDeleteTarget(null);
            const label = type === "hard"
              ? "ลบถาวรสำเร็จ"
              : "ระงับบัญชีสำเร็จ (รอลบใน 90 วัน)";
            showToast(`${deleteTarget.email} — ${label}`);
            void fetchTenants();
          }}
        />
      )}
    </div>
  );
}
