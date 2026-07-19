"use client";

import { useState, useEffect, useCallback } from "react";
import { DeleteAccountModal, type DeleteTarget } from "@/components/admin/DeleteAccountModal";

interface Partner {
  _id:               string;
  companyName:       string;
  email:             string;
  status:            "invited" | "active" | "suspended";
  isStripeConnected: boolean;
  totalActiveSlots:  number;
  totalEarningsThb:  number;
  createdAt:         string;
  pendingDeleteAt?:  string | null;
  isOrphaned?:       boolean;
}

const STATUS_BADGE: Record<string, string> = {
  active:    "bg-green-100 text-green-700",
  invited:   "bg-amber-100 text-amber-700",
  suspended: "bg-red-100 text-red-700",
};

export default function AdminPartnersPage() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [total,    setTotal]    = useState(0);
  const [page,     setPage]     = useState(1);
  const [search,   setSearch]   = useState("");
  const [loading,  setLoading]  = useState(true);

  // Invite modal
  const [showInvite,   setShowInvite]   = useState(false);
  const [inviteData,   setInviteData]   = useState({ companyName: "", email: "", phone: "" });
  const [inviting,     setInviting]     = useState(false);
  const [inviteResult, setInviteResult] = useState<{ verifyUrl: string; verifyCode: string; emailSent?: boolean } | null>(null);
  const [inviteError,  setInviteError]  = useState("");

  // Delete modal (reusable component)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  // Orphan hard-delete (no PartnerProfile — bypass DeleteAccountModal)
  const [orphanDeleteTarget, setOrphanDeleteTarget] = useState<{ email: string; name: string } | null>(null);
  const [orphanDeleting,     setOrphanDeleting]     = useState(false);
  const [orphanError,        setOrphanError]        = useState("");

  async function handleOrphanDelete() {
    if (!orphanDeleteTarget) return;
    setOrphanDeleting(true);
    setOrphanError("");
    try {
      const res  = await fetch("/api/admin/delete-account", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email: orphanDeleteTarget.email, confirm: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "server_error");
      showToast(`${orphanDeleteTarget.email} — ลบถาวรสำเร็จ`);
      setOrphanDeleteTarget(null);
      load();
    } catch (e) {
      setOrphanError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด");
    } finally {
      setOrphanDeleting(false);
    }
  }

  // Resend result modal
  const [resendLink,      setResendLink]      = useState<string | null>(null);
  const [resendCode,      setResendCode]      = useState<string | null>(null);
  const [resendEmailSent, setResendEmailSent] = useState<boolean>(true);

  // Toast
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  }

  function copyToClipboard(text: string, label = "คัดลอกแล้ว") {
    navigator.clipboard.writeText(text).catch(() => {
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    });
    showToast(label);
  }

  const limit = 20;

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search) params.set("q", search);
    fetch(`/api/admin/partners?${params}`)
      .then((r) => r.json())
      .then((d) => { setPartners(d.partners ?? []); setTotal(d.total ?? 0); })
      .finally(() => setLoading(false));
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteError("");
    setInviting(true);
    try {
      const res = await fetch("/api/admin/partners", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(inviteData),
      });
      const data = await res.json();
      if (!res.ok) {
        setInviteError(data.error === "already_invited" ? "This email is already invited." : "Failed to invite.");
        return;
      }
      setInviteResult(data);
      load();
    } catch {
      setInviteError("Network error.");
    } finally {
      setInviting(false);
    }
  }

  async function toggleStatus(id: string, status: "active" | "suspended") {
    await fetch(`/api/admin/partners/${id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ status }),
    });
    load();
  }

  async function resendInvite(id: string) {
    const res = await fetch(`/api/admin/partners/${id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ resendInvite: true }),
    });
    const data = await res.json();
    const pVerifyUrl = data.partner?.verifyUrl;
    if (pVerifyUrl) {
      setResendLink(pVerifyUrl);
      setResendCode(data.partner?.verifyCode ?? null);
      setResendEmailSent(data.partner?.emailSent !== false);
    }
  }

  async function handleRestore(p: Partner) {
    try {
      const res = await fetch(`/api/admin/partners/${p._id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ action: "restore" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "server_error");
      showToast(`${p.email} — กู้คืนบัญชีสำเร็จ`);
      load();
    } catch {
      showToast("กู้คืนไม่สำเร็จ กรุณาลองใหม่", false);
    }
  }

  const totalPages = Math.ceil(total / limit);
  const thb = (n: number) => `฿${n.toLocaleString("th-TH")}`;

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] px-5 py-3 rounded-2xl shadow-lg text-sm font-medium pointer-events-none ${
          toast.ok ? "bg-gray-900 text-white" : "bg-red-600 text-white"
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Partners</h1>
          <p className="text-xs text-text-muted mt-0.5">{total} total partners</p>
        </div>
        <button
          onClick={() => { setShowInvite(true); setInviteResult(null); setInviteError(""); }}
          className="px-4 py-2 bg-brand-600 text-white text-sm font-semibold rounded-xl hover:bg-brand-700 transition-colors"
        >
          + Invite Partner
        </button>
      </div>

      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        placeholder="Search by company or email…"
        className="w-full px-4 py-2.5 rounded-xl border border-border-default bg-surface-primary text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-600"
      />

      {/* Table */}
      <div className="bg-surface-primary rounded-2xl border border-border-default overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-text-muted text-sm">Loading…</div>
        ) : partners.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-text-muted text-sm">No partners yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-default bg-surface-secondary">
                <th className="text-left px-4 py-3 text-xs font-medium text-text-muted">Company / Email</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-text-muted">Status</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-text-muted">Stripe</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-text-muted">Clients</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-text-muted">Earnings</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-text-muted">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-default">
              {partners.map((p) => {
                const isPendingDelete = !!p.pendingDeleteAt;
                const deletionDate   = isPendingDelete
                  ? new Date(p.pendingDeleteAt!).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" })
                  : null;

                if (p.isOrphaned) {
                  return (
                    <tr key={p._id} className="bg-orange-50/50 hover:bg-orange-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-text-primary">{p.companyName}</p>
                        <p className="text-xs text-text-muted">{p.email}</p>
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-orange-700 bg-orange-100 border border-orange-200 rounded-full px-2 py-0.5 mt-1">
                          ⚠️ Orphaned — ไม่มี PartnerProfile
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-orange-100 text-orange-700">partner_admin</span>
                      </td>
                      <td className="px-4 py-3 text-center"><span className="text-gray-400 text-base">–</span></td>
                      <td className="px-4 py-3 text-right text-text-muted">–</td>
                      <td className="px-4 py-3 text-right text-text-muted">–</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => { setOrphanDeleteTarget({ email: p.email, name: p.companyName }); setOrphanError(""); }}
                          className="text-xs px-2.5 py-1 rounded-lg border border-red-400 bg-red-50 text-red-700 hover:bg-red-100 font-semibold transition-colors whitespace-nowrap"
                        >
                          ลบถาวร
                        </button>
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr
                    key={p._id}
                    className={`transition-colors ${isPendingDelete ? "bg-red-50/40 hover:bg-red-50/60" : "hover:bg-surface-secondary"}`}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-text-primary">{p.companyName}</p>
                      <p className="text-xs text-text-muted">{p.email}</p>
                      {isPendingDelete && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5 mt-1">
                          ⏳ รอลบถาวร {deletionDate}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={[
                        "text-xs font-semibold px-2.5 py-0.5 rounded-full capitalize",
                        STATUS_BADGE[p.status] ?? "bg-gray-100 text-gray-500",
                      ].join(" ")}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {p.isStripeConnected
                        ? <span className="text-green-600 text-base">✓</span>
                        : <span className="text-gray-400 text-base">–</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-text-secondary">{p.totalActiveSlots}</td>
                    <td className="px-4 py-3 text-right text-text-secondary">{thb(p.totalEarningsThb)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {isPendingDelete ? (
                          <button
                            onClick={() => handleRestore(p)}
                            className="text-xs px-2.5 py-1 rounded-lg border border-green-300 text-green-700 hover:bg-green-50 font-medium transition-colors whitespace-nowrap"
                          >
                            กู้คืนบัญชี
                          </button>
                        ) : (
                          <>
                            {p.status === "invited" && (
                              <button
                                onClick={() => resendInvite(p._id)}
                                className="text-xs px-2.5 py-1 rounded-lg border border-border-default text-text-muted hover:text-text-primary hover:border-text-secondary transition-colors"
                              >
                                Resend
                              </button>
                            )}
                            {p.status === "active" && (
                              <button
                                onClick={() => toggleStatus(p._id, "suspended")}
                                className="text-xs px-2.5 py-1 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                              >
                                Suspend
                              </button>
                            )}
                            {p.status === "suspended" && (
                              <button
                                onClick={() => toggleStatus(p._id, "active")}
                                className="text-xs px-2.5 py-1 rounded-lg border border-green-200 text-green-700 hover:bg-green-50 transition-colors"
                              >
                                Reactivate
                              </button>
                            )}
                            <button
                              onClick={() => setDeleteTarget({ id: p._id, name: p.companyName, email: p.email, type: "partner" })}
                              className="text-xs px-2.5 py-1 rounded-lg border border-red-300 text-red-600 hover:bg-red-50 transition-colors"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </div>
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

      {/* Orphan hard-delete confirmation modal */}
      {orphanDeleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4 space-y-4">
            <div className="text-center">
              <div className="text-4xl mb-2">🗑️</div>
              <h2 className="font-bold text-text-primary">ลบบัญชีถาวร</h2>
              <p className="text-sm text-text-muted mt-1 break-all">{orphanDeleteTarget.email}</p>
              <p className="text-xs text-red-600 mt-2 font-medium">ลบข้อมูลทั้งหมดออกจากระบบ — กู้คืนไม่ได้</p>
            </div>
            {orphanError && (
              <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">{orphanError}</div>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => { setOrphanDeleteTarget(null); setOrphanError(""); }}
                disabled={orphanDeleting}
                className="flex-1 py-2.5 rounded-xl border border-border-default text-sm font-semibold text-text-secondary hover:bg-surface-secondary transition-colors disabled:opacity-50"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleOrphanDelete}
                disabled={orphanDeleting}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold transition-colors disabled:opacity-50"
              >
                {orphanDeleting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    กำลังลบ…
                  </span>
                ) : "ยืนยัน ลบถาวร"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reusable 2-step delete modal */}
      {deleteTarget && (
        <DeleteAccountModal
          target={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onSuccess={(type) => {
            const label = type === "hard"
              ? "ลบถาวรสำเร็จ"
              : "ระงับบัญชีสำเร็จ (รอลบใน 90 วัน)";
            showToast(`${deleteTarget.email} — ${label}`);
            setDeleteTarget(null);
            load();
          }}
        />
      )}

      {/* Resend Result Modal */}
      {resendLink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-text-primary">
                {resendEmailSent ? "ส่งอีเมล์ใหม่แล้ว" : "สร้างลิงก์ใหม่แล้ว — ส่งอีเมล์ไม่สำเร็จ"}
              </h2>
              <button onClick={() => { setResendLink(null); setResendCode(null); }} className="text-text-muted hover:text-text-primary text-lg">×</button>
            </div>
            <div className={`border rounded-xl p-4 mb-3 ${resendEmailSent ? "bg-blue-50 border-blue-200" : "bg-amber-50 border-amber-200"}`}>
              <p className={`text-xs font-medium mb-2 ${resendEmailSent ? "text-blue-700" : "text-amber-700"}`}>Verify Link (มีอายุ 24 ชั่วโมง)</p>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={resendLink}
                  className={`flex-1 px-3 py-2 rounded-xl border bg-white text-xs font-mono ${resendEmailSent ? "border-blue-300" : "border-amber-300"}`}
                />
                <button
                  onClick={() => copyToClipboard(resendLink)}
                  className={`px-3 py-2 rounded-xl text-white text-xs font-semibold ${resendEmailSent ? "bg-blue-600 hover:bg-blue-700" : "bg-amber-600 hover:bg-amber-700"}`}
                >
                  Copy
                </button>
              </div>
            </div>
            {resendCode && (
              <div className="border border-purple-200 rounded-xl p-4 mb-4 bg-purple-50">
                <p className="text-xs font-medium text-purple-700 mb-2">Verify Code (แจ้งพาร์ทเนอร์ผ่านช่องทางอื่น)</p>
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold tracking-widest text-purple-900 font-mono">{resendCode}</span>
                  <button
                    onClick={() => copyToClipboard(resendCode!, "คัดลอก Code แล้ว")}
                    className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold"
                  >
                    Copy
                  </button>
                </div>
              </div>
            )}
            <button
              onClick={() => { setResendLink(null); setResendCode(null); }}
              className="w-full py-2 rounded-xl border border-border-default text-sm text-text-secondary hover:bg-surface-secondary"
            >
              ปิด
            </button>
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-text-primary">Invite Partner</h2>
              <button onClick={() => setShowInvite(false)} className="text-text-muted hover:text-text-primary text-lg">×</button>
            </div>

            {inviteResult ? (
              <div className="space-y-3">
                <div className={`border rounded-xl p-4 ${inviteResult.emailSent === false ? "bg-amber-50 border-amber-200" : "bg-green-50 border-green-200"}`}>
                  <p className={`text-sm font-semibold mb-1 ${inviteResult.emailSent === false ? "text-amber-800" : "text-green-800"}`}>
                    {inviteResult.emailSent === false ? "บันทึกแล้ว — ส่งอีเมล์ไม่สำเร็จ" : "Partner invited!"}
                  </p>
                  <p className={`text-xs font-medium mb-2 ${inviteResult.emailSent === false ? "text-amber-700" : "text-green-700"}`}>
                    Verify Link (มีอายุ 24 ชั่วโมง)
                  </p>
                  <div className="flex gap-2">
                    <input
                      readOnly
                      value={inviteResult.verifyUrl}
                      className={`flex-1 px-3 py-2 rounded-xl border bg-white text-xs font-mono ${inviteResult.emailSent === false ? "border-amber-300" : "border-green-300"}`}
                    />
                    <button
                      onClick={() => copyToClipboard(inviteResult.verifyUrl)}
                      className={`px-3 py-2 rounded-xl text-white text-xs font-semibold ${inviteResult.emailSent === false ? "bg-amber-600 hover:bg-amber-700" : "bg-green-600 hover:bg-green-700"}`}
                    >
                      Copy
                    </button>
                  </div>
                </div>
                <div className="border border-purple-200 rounded-xl p-4 bg-purple-50">
                  <p className="text-xs font-medium text-purple-700 mb-2">Verify Code (แจ้งพาร์ทเนอร์ผ่านช่องทางอื่น เช่น โทรศัพท์)</p>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-bold tracking-widest text-purple-900 font-mono">{inviteResult.verifyCode}</span>
                    <button
                      onClick={() => copyToClipboard(inviteResult.verifyCode, "คัดลอก Code แล้ว")}
                      className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold"
                    >
                      Copy
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => { setShowInvite(false); setInviteData({ companyName: "", email: "", phone: "" }); }}
                  className="w-full py-2 rounded-xl border border-border-default text-sm text-text-secondary hover:bg-surface-secondary"
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleInvite} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Company Name *</label>
                  <input
                    type="text"
                    value={inviteData.companyName}
                    onChange={(e) => setInviteData({ ...inviteData, companyName: e.target.value })}
                    required
                    className="w-full px-3 py-2 rounded-xl border border-border-default bg-surface-secondary text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Email *</label>
                  <input
                    type="email"
                    value={inviteData.email}
                    onChange={(e) => setInviteData({ ...inviteData, email: e.target.value })}
                    required
                    className="w-full px-3 py-2 rounded-xl border border-border-default bg-surface-secondary text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Phone (optional)</label>
                  <input
                    type="text"
                    value={inviteData.phone}
                    onChange={(e) => setInviteData({ ...inviteData, phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-border-default bg-surface-secondary text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
                  />
                </div>

                {inviteError && (
                  <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2 text-xs text-red-700">{inviteError}</div>
                )}

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowInvite(false)}
                    className="flex-1 py-2.5 rounded-xl border border-border-default text-sm text-text-secondary hover:bg-surface-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={inviting}
                    className="flex-1 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 disabled:opacity-50 transition-colors"
                  >
                    {inviting ? "Inviting…" : "Send Invite"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
