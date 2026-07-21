"use client";

import { useCallback, useEffect, useState } from "react";
import { DeleteAccountModal, type DeleteTarget } from "@/components/admin/DeleteAccountModal";

// ── Types ─────────────────────────────────────────────────────────────────────

type AccountType = "tenant" | "partner" | "vip" | "admin" | "pending";
type BotState =
  | "trial" | "trial_quota_daily_exhausted" | "trial_expired" | "active"
  | "grace_5pct" | "suspended_quota" | "suspended_payment" | "pending_kyc" | "disabled";

interface AccountRow {
  email:     string;
  userId?:   string;
  createdAt?: string;
  types:     AccountType[];
  tenant?: { botState: BotState; trialEndsAt?: string; pendingDeleteAt?: string; deletedByAdmin?: boolean };
  partner?: { partnerId?: string; status: string; isOrphaned: boolean; pendingDeleteAt?: string };
  vip?: { vipId: string; isActive: boolean; endDate?: string; label?: string };
  admin?: { role: string };
  pending?: { attempts: number; lastAttemptAt: string };
}

interface ApiResponse {
  accounts: AccountRow[];
  total: number;
  page: number;
  limit: number;
}

const BOT_STATES: BotState[] = [
  "trial", "trial_quota_daily_exhausted", "trial_expired", "active",
  "grace_5pct", "suspended_quota", "suspended_payment", "pending_kyc", "disabled",
];

const TYPE_BADGE: Record<AccountType, string> = {
  tenant:  "bg-blue-100    text-blue-800    border-blue-200",
  partner: "bg-purple-100  text-purple-800  border-purple-200",
  vip:     "bg-amber-100   text-amber-800   border-amber-200",
  admin:   "bg-zinc-200    text-zinc-800    border-zinc-300",
  pending: "bg-orange-100  text-orange-800  border-orange-200",
};

const PAGE_SIZE = 20;

function TypeBadges({ types }: { types: AccountType[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {types.map((t) => (
        <span key={t} className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border capitalize ${TYPE_BADGE[t]}`}>
          {t}
        </span>
      ))}
    </div>
  );
}

export default function AdminAccountsPage() {
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [total,    setTotal]    = useState(0);
  const [page,     setPage]     = useState(1);
  const [search,   setSearch]   = useState("");
  const [typeFilter, setTypeFilter] = useState<AccountType | "">("");
  const [loading,  setLoading]  = useState(true);

  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [busyEmail, setBusyEmail] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [botStatePick, setBotStatePick] = useState<Record<string, BotState>>({});

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4500);
  }

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    if (search) params.set("q", search);
    if (typeFilter) params.set("type", typeFilter);
    fetch(`/api/admin/accounts?${params}`)
      .then((r) => r.json())
      .then((d: ApiResponse) => { setAccounts(d.accounts ?? []); setTotal(d.total ?? 0); })
      .finally(() => setLoading(false));
  }, [page, search, typeFilter]);

  useEffect(() => { load(); }, [load]);

  async function runAction(email: string, action: string, extra?: Record<string, unknown>) {
    setBusyEmail(email);
    try {
      const res = await fetch(`/api/admin/accounts/${encodeURIComponent(email)}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "server_error");
      showToast(data.note ?? `${email} — ${action} สำเร็จ`);
      load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "เกิดข้อผิดพลาด", false);
    } finally {
      setBusyEmail(null);
    }
  }

  function confirmAndRun(email: string, action: string, confirmMsg: string, extra?: Record<string, unknown>) {
    if (!window.confirm(confirmMsg)) return;
    void runAction(email, action, extra);
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] px-5 py-3 rounded-2xl shadow-lg text-sm font-medium pointer-events-none max-w-lg text-center ${
          toast.ok ? "bg-gray-900 text-white" : "bg-red-600 text-white"
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-text-primary">Accounts</h1>
        <p className="text-xs text-text-muted mt-0.5">{total} รายการอีเมล์ทั้งหมดในระบบ (tenant / partner / vip / admin)</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="ค้นหาอีเมล์..."
          className="flex-1 min-w-[240px] px-4 py-2.5 rounded-xl border border-border-default bg-surface-primary text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-600"
        />
        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value as AccountType | ""); setPage(1); }}
          className="px-3 py-2.5 rounded-xl border border-border-default bg-surface-primary text-sm"
        >
          <option value="">ทุกประเภท</option>
          <option value="tenant">Tenant</option>
          <option value="partner">Partner</option>
          <option value="vip">VIP</option>
          <option value="admin">Admin</option>
          <option value="pending">Pending (สมัครไม่สำเร็จ)</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-surface-primary rounded-2xl border border-border-default overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-text-muted text-sm">Loading…</div>
        ) : accounts.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-text-muted text-sm">ไม่พบข้อมูล</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-default bg-surface-secondary">
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-muted">Email</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-muted">ประเภท</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-text-muted">สถานะ</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-text-muted">การจัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-default">
                {accounts.map((a) => {
                  const isBusy = busyEmail === a.email;
                  return (
                    <tr key={a.email} className="hover:bg-surface-secondary transition-colors align-top">
                      <td className="px-4 py-3">
                        <p className="font-medium text-text-primary break-all">{a.email}</p>
                        {a.createdAt && (
                          <p className="text-xs text-text-muted mt-0.5">
                            {new Date(a.createdAt).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" })}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3"><TypeBadges types={a.types} /></td>
                      <td className="px-4 py-3 space-y-1 text-xs">
                        {a.tenant && (
                          <p><span className="text-text-muted">Tenant:</span> <span className="font-semibold text-text-primary">{a.tenant.botState}</span>{a.tenant.pendingDeleteAt && <span className="ml-1 text-red-600">(รอลบ)</span>}</p>
                        )}
                        {a.partner && (
                          <p><span className="text-text-muted">Partner:</span> <span className="font-semibold text-text-primary">{a.partner.status}</span>{a.partner.isOrphaned && <span className="ml-1 text-orange-600">(orphaned)</span>}</p>
                        )}
                        {a.vip && (
                          <p><span className="text-text-muted">VIP:</span> <span className="font-semibold text-text-primary">{a.vip.isActive ? "active" : "inactive"}</span></p>
                        )}
                        {a.admin && (
                          <p><span className="text-text-muted">Admin:</span> <span className="font-semibold text-text-primary">{a.admin.role}</span></p>
                        )}
                        {a.pending && (
                          <div>
                            <p><span className="text-orange-700 font-semibold">สมัครไม่สำเร็จ</span> — ไม่มีบัญชีในระบบ</p>
                            <p className="text-text-muted">
                              พยายาม {a.pending.attempts} ครั้ง — ล่าสุด {new Date(a.pending.lastAttemptAt).toLocaleString("th-TH", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
                            </p>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col items-end gap-1.5">
                          <div className="flex flex-wrap justify-end gap-1.5">
                            <button
                              disabled={isBusy}
                              onClick={() => confirmAndRun(a.email, "force_logout", `Force logout ${a.email}?\nจะออกจากระบบในการเรียกครั้งถัดไป`)}
                              className="text-xs px-2.5 py-1 rounded-lg border border-border-default text-text-muted hover:text-text-primary hover:border-text-secondary transition-colors disabled:opacity-40"
                            >
                              Force Logout
                            </button>
                            <button
                              disabled={isBusy}
                              onClick={() => confirmAndRun(a.email, "clear_cache", `Clear rate-limit cache สำหรับ ${a.email}?`)}
                              className="text-xs px-2.5 py-1 rounded-lg border border-border-default text-text-muted hover:text-text-primary hover:border-text-secondary transition-colors disabled:opacity-40"
                            >
                              Clear Cache
                            </button>
                            {a.tenant && (
                              a.tenant.botState === "disabled"
                                ? <button disabled={isBusy} onClick={() => runAction(a.email, "reactivate", { targetType: "tenant" })} className="text-xs px-2.5 py-1 rounded-lg border border-green-200 text-green-700 hover:bg-green-50 transition-colors disabled:opacity-40">Reactivate</button>
                                : <button disabled={isBusy} onClick={() => confirmAndRun(a.email, "suspend", `Suspend tenant ${a.email}?`, { targetType: "tenant" })} className="text-xs px-2.5 py-1 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40">Suspend</button>
                            )}
                            {a.partner && (
                              a.partner.status === "suspended"
                                ? <button disabled={isBusy} onClick={() => runAction(a.email, "reactivate", { targetType: "partner" })} className="text-xs px-2.5 py-1 rounded-lg border border-green-200 text-green-700 hover:bg-green-50 transition-colors disabled:opacity-40">Reactivate Partner</button>
                                : <button disabled={isBusy} onClick={() => confirmAndRun(a.email, "suspend", `Suspend partner ${a.email}?`, { targetType: "partner" })} className="text-xs px-2.5 py-1 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40">Suspend Partner</button>
                            )}
                            {(a.tenant?.pendingDeleteAt || a.partner?.pendingDeleteAt) && (
                              <button
                                disabled={isBusy}
                                onClick={() => runAction(a.email, "restore", { targetType: a.tenant?.pendingDeleteAt ? "tenant" : "partner" })}
                                className="text-xs px-2.5 py-1 rounded-lg border border-green-300 text-green-700 hover:bg-green-50 font-medium transition-colors disabled:opacity-40"
                              >
                                กู้คืนบัญชี
                              </button>
                            )}
                            {((a.tenant && a.userId) || (a.partner && a.partner.partnerId)) && (
                              <button
                                disabled={isBusy}
                                onClick={() => setDeleteTarget({
                                  id: (a.tenant ? a.userId : a.partner?.partnerId) ?? "",
                                  name: a.email, email: a.email,
                                  type: a.tenant ? "tenant" : "partner",
                                })}
                                className="text-xs px-2.5 py-1 rounded-lg border border-red-300 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                          {a.tenant && (
                            <div className="flex items-center gap-1">
                              <select
                                value={botStatePick[a.email] ?? a.tenant.botState}
                                onChange={(e) => setBotStatePick((p) => ({ ...p, [a.email]: e.target.value as BotState }))}
                                className="text-xs border border-border-default rounded-lg px-1.5 py-1"
                              >
                                {BOT_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                              </select>
                              <button
                                disabled={isBusy}
                                onClick={() => confirmAndRun(a.email, "set_bot_state", `ตั้งค่า botState ของ ${a.email} เป็น "${botStatePick[a.email] ?? a.tenant!.botState}"?`, { botState: botStatePick[a.email] ?? a.tenant!.botState })}
                                className="text-xs px-2 py-1 rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40"
                              >
                                ตั้งค่า
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 rounded-xl border border-border-default text-xs text-text-secondary hover:bg-surface-secondary disabled:opacity-40"
          >Previous</button>
          <span className="text-xs text-text-muted">Page {page} / {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 rounded-xl border border-border-default text-xs text-text-secondary hover:bg-surface-secondary disabled:opacity-40"
          >Next</button>
        </div>
      )}

      {deleteTarget && (
        <DeleteAccountModal
          target={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onSuccess={(type) => {
            const label = type === "hard" ? "ลบถาวรสำเร็จ" : "ระงับบัญชีสำเร็จ (รอลบใน 90 วัน)";
            showToast(`${deleteTarget.email} — ${label}`);
            setDeleteTarget(null);
            load();
          }}
        />
      )}
    </div>
  );
}
