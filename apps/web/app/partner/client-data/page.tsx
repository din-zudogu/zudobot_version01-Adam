"use client";

import { useState, useEffect, useCallback } from "react";

type EntityType = "individual" | "corporate";

interface ClientRecord {
  _id:           string;
  entityType:    EntityType;
  fullName:      string;
  nationalId:    string;
  passport:      string;
  addressBilling:string;
  phone:         string;
  email:         string;
  corporateName: string;
  taxId:         string;
  addressOffice: string;
  branchCode:    string;
  contactPerson: string;
  tenantId?:     string;
  createdAt:     string;
}

const EMPTY_FORM = {
  entityType:    "individual" as EntityType,
  fullName:      "",
  nationalId:    "",
  passport:      "",
  addressBilling:"",
  phone:         "",
  email:         "",
  corporateName: "",
  taxId:         "",
  addressOffice: "",
  branchCode:    "",
  contactPerson: "",
};

// ── MaskedField ───────────────────────────────────────────────────────────────

function MaskedField({ label, value, onUnmask }: { label: string; value: string; onUnmask: () => void }) {
  return (
    <div>
      <p className="text-xs text-text-muted">{label}</p>
      <div className="flex items-center gap-1">
        <p className="text-sm text-text-primary font-mono">{value || "—"}</p>
        {value && value.includes("X") && (
          <button onClick={onUnmask} title="แสดงข้อมูลจริง"
            className="text-text-muted hover:text-text-primary transition-colors text-xs">👁</button>
        )}
      </div>
    </div>
  );
}

// ── Client form modal ─────────────────────────────────────────────────────────

function ClientFormModal({
  initial, onClose, onSaved, editId,
}: {
  initial?: typeof EMPTY_FORM;
  onClose: () => void;
  onSaved: () => void;
  editId?: string;
}) {
  const [form,   setForm]   = useState(initial ?? EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");

  function set<K extends keyof typeof EMPTY_FORM>(key: K, val: string) {
    setForm((prev) => ({ ...prev, [key]: val }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const url    = editId ? `/api/partner/client-data/${editId}` : "/api/partner/client-data";
      const method = editId ? "PUT" : "POST";
      const res    = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "บันทึกไม่สำเร็จ"); return; }
      onSaved();
    } catch {
      setError("Network error กรุณาลองใหม่");
    } finally {
      setSaving(false);
    }
  }

  const isInd  = form.entityType === "individual";
  const isCorp = form.entityType === "corporate";

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface-primary rounded-2xl border border-border-default w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-border-default flex items-center justify-between">
          <h2 className="text-base font-semibold text-text-primary">
            {editId ? "แก้ไขข้อมูลลูกค้า" : "เพิ่มข้อมูลลูกค้าใหม่"}
          </h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary text-xl leading-none">✕</button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-5">
          {/* Entity type */}
          <div>
            <p className="text-xs text-text-muted mb-2">ประเภทลูกค้า</p>
            <div className="grid grid-cols-2 gap-2">
              {(["individual", "corporate"] as EntityType[]).map((type) => (
                <label key={type} className={["flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all",
                  form.entityType === type ? "border-brand-500 bg-brand-50" : "border-border-default hover:border-brand-300",
                ].join(" ")}>
                  <input type="radio" name="entityType" checked={form.entityType === type}
                    onChange={() => set("entityType", type)} className="accent-brand-600" />
                  <span className="text-sm">{type === "individual" ? "👤 บุคคลธรรมดา" : "🏢 นิติบุคคล"}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Individual fields */}
          {isInd && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-text-muted mb-1">ชื่อ-นามสกุล <span className="text-red-500">*</span></label>
                  <input value={form.fullName} onChange={(e) => set("fullName", e.target.value)} required
                    className="w-full px-3 py-2 rounded-xl border border-border-default text-sm bg-surface-secondary focus:outline-none focus:border-brand-400" />
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">เลขบัตรประชาชน (13 หลัก) <span className="text-red-500">*</span></label>
                  <input value={form.nationalId} onChange={(e) => set("nationalId", e.target.value)} required
                    placeholder="1234567890123"
                    className="w-full px-3 py-2 rounded-xl border border-border-default text-sm bg-surface-secondary focus:outline-none focus:border-brand-400" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">ที่อยู่จัดส่งบิล <span className="text-red-500">*</span></label>
                <input value={form.addressBilling} onChange={(e) => set("addressBilling", e.target.value)} required
                  className="w-full px-3 py-2 rounded-xl border border-border-default text-sm bg-surface-secondary focus:outline-none focus:border-brand-400" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-text-muted mb-1">เบอร์โทรศัพท์ <span className="text-red-500">*</span></label>
                  <input value={form.phone} onChange={(e) => set("phone", e.target.value)} required type="tel"
                    placeholder="0812345678"
                    className="w-full px-3 py-2 rounded-xl border border-border-default text-sm bg-surface-secondary focus:outline-none focus:border-brand-400" />
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">อีเมล <span className="text-red-500">*</span></label>
                  <input value={form.email} onChange={(e) => set("email", e.target.value)} required type="email"
                    className="w-full px-3 py-2 rounded-xl border border-border-default text-sm bg-surface-secondary focus:outline-none focus:border-brand-400" />
                </div>
              </div>
            </div>
          )}

          {/* Corporate fields */}
          {isCorp && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-text-muted mb-1">ชื่อนิติบุคคล <span className="text-red-500">*</span></label>
                  <input value={form.corporateName} onChange={(e) => set("corporateName", e.target.value)} required
                    className="w-full px-3 py-2 rounded-xl border border-border-default text-sm bg-surface-secondary focus:outline-none focus:border-brand-400" />
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">เลขผู้เสียภาษี (13 หลัก) <span className="text-red-500">*</span></label>
                  <input value={form.taxId} onChange={(e) => set("taxId", e.target.value)} required
                    placeholder="1234567890123"
                    className="w-full px-3 py-2 rounded-xl border border-border-default text-sm bg-surface-secondary focus:outline-none focus:border-brand-400" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">ที่อยู่สำนักงาน <span className="text-red-500">*</span></label>
                <input value={form.addressOffice} onChange={(e) => set("addressOffice", e.target.value)} required
                  className="w-full px-3 py-2 rounded-xl border border-border-default text-sm bg-surface-secondary focus:outline-none focus:border-brand-400" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-text-muted mb-1">รหัสสาขา</label>
                  <input value={form.branchCode} onChange={(e) => set("branchCode", e.target.value)}
                    placeholder="00000"
                    className="w-full px-3 py-2 rounded-xl border border-border-default text-sm bg-surface-secondary focus:outline-none focus:border-brand-400" />
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">ผู้ประสานงาน <span className="text-red-500">*</span></label>
                  <input value={form.contactPerson} onChange={(e) => set("contactPerson", e.target.value)} required
                    className="w-full px-3 py-2 rounded-xl border border-border-default text-sm bg-surface-secondary focus:outline-none focus:border-brand-400" />
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1">เบอร์โทร <span className="text-red-500">*</span></label>
                  <input value={form.phone} onChange={(e) => set("phone", e.target.value)} required type="tel"
                    className="w-full px-3 py-2 rounded-xl border border-border-default text-sm bg-surface-secondary focus:outline-none focus:border-brand-400" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-text-muted mb-1">อีเมลติดต่อ <span className="text-red-500">*</span></label>
                <input value={form.email} onChange={(e) => set("email", e.target.value)} required type="email"
                  className="w-full px-3 py-2 rounded-xl border border-border-default text-sm bg-surface-secondary focus:outline-none focus:border-brand-400" />
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 text-sm text-red-700">{error}</div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-border-default text-sm text-text-secondary hover:bg-surface-secondary transition-colors">
              ยกเลิก
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 disabled:opacity-50 transition-colors">
              {saving ? "กำลังบันทึก…" : "บันทึก"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PartnerClientDataPage() {
  const [clients,   setClients]   = useState<ClientRecord[]>([]);
  const [total,     setTotal]     = useState(0);
  const [page,      setPage]      = useState(1);
  const [loading,   setLoading]   = useState(true);
  const [showForm,  setShowForm]  = useState(false);
  const [editItem,  setEditItem]  = useState<ClientRecord | null>(null);
  const [expanded,  setExpanded]  = useState<string | null>(null);
  const [unmasked,  setUnmasked]  = useState<Record<string, ClientRecord>>({});

  const limit = 20;

  const loadClients = useCallback(() => {
    setLoading(true);
    fetch(`/api/partner/client-data?page=${page}&limit=${limit}`)
      .then((r) => r.json())
      .then((d) => { setClients(d.clients ?? []); setTotal(d.total ?? 0); })
      .finally(() => setLoading(false));
  }, [page]);

  useEffect(() => { loadClients(); }, [loadClients]);

  async function handleUnmask(id: string) {
    const res  = await fetch(`/api/partner/client-data/${id}?unmask=1`);
    const data = await res.json();
    if (data.client) setUnmasked((prev) => ({ ...prev, [id]: data.client }));
  }

  async function handleDelete(id: string) {
    if (!confirm("ลบข้อมูลลูกค้านี้?")) return;
    await fetch(`/api/partner/client-data/${id}`, { method: "DELETE" });
    loadClients();
  }

  const totalPages = Math.ceil(total / limit);

  const displayClient = (c: ClientRecord) => unmasked[c._id] ?? c;

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">ข้อมูลลูกค้า (Client Data)</h1>
          <p className="text-sm text-text-muted mt-0.5">ข้อมูลเชิง Legal ของลูกค้า — เข้ารหัส AES-256</p>
        </div>
        <button onClick={() => { setEditItem(null); setShowForm(true); }}
          className="px-4 py-2 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 transition-colors">
          + เพิ่มลูกค้าใหม่
        </button>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 text-xs text-amber-800">
        🔒 ข้อมูล National ID, Tax ID, เบอร์โทร และอีเมล ถูกเข้ารหัส AES-256-GCM — คลิก 👁 เพื่อแสดงข้อมูลจริง
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-text-muted text-sm">กำลังโหลด…</div>
      ) : clients.length === 0 ? (
        <div className="bg-surface-primary rounded-2xl border border-border-default flex items-center justify-center h-40 text-text-muted text-sm">
          ยังไม่มีข้อมูลลูกค้า คลิก &quot;+ เพิ่มลูกค้าใหม่&quot; เพื่อเริ่มต้น
        </div>
      ) : (
        <div className="space-y-3">
          {clients.map((c) => {
            const d = displayClient(c);
            const isExp = expanded === c._id;
            return (
              <div key={c._id} className="bg-surface-primary rounded-2xl border border-border-default overflow-hidden">
                {/* Header */}
                <div className="flex items-center gap-3 px-5 py-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-text-primary">
                        {d.entityType === "individual" ? (d.fullName || "บุคคลธรรมดา") : (d.corporateName || "นิติบุคคล")}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        d.entityType === "individual" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                      }`}>
                        {d.entityType === "individual" ? "บุคคลธรรมดา" : "นิติบุคคล"}
                      </span>
                    </div>
                    <p className="text-xs text-text-muted mt-0.5">
                      {d.email} · {d.phone} · เพิ่มเมื่อ {new Date(c.createdAt).toLocaleDateString("th-TH")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => handleUnmask(c._id)} title="แสดงข้อมูลจริง"
                      className="text-text-muted hover:text-text-primary text-sm transition-colors">👁</button>
                    <button onClick={() => { setEditItem(c); setShowForm(true); }}
                      className="text-xs text-brand-600 hover:underline">แก้ไข</button>
                    <button onClick={() => handleDelete(c._id)}
                      className="text-xs text-red-500 hover:underline">ลบ</button>
                    <button onClick={() => setExpanded(isExp ? null : c._id)}
                      className="text-xs text-text-muted hover:text-text-secondary">
                      {isExp ? "ซ่อน" : "รายละเอียด"}
                    </button>
                  </div>
                </div>

                {/* Expanded detail */}
                {isExp && (
                  <div className="border-t border-border-default bg-surface-secondary px-5 py-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                      {d.entityType === "individual" ? (
                        <>
                          <MaskedField label="เลขบัตรประชาชน" value={d.nationalId} onUnmask={() => handleUnmask(c._id)} />
                          <MaskedField label="เบอร์โทร"       value={d.phone}      onUnmask={() => handleUnmask(c._id)} />
                          <MaskedField label="อีเมล"          value={d.email}      onUnmask={() => handleUnmask(c._id)} />
                          <div className="col-span-2 sm:col-span-3">
                            <p className="text-xs text-text-muted">ที่อยู่จัดส่งบิล</p>
                            <p className="text-sm text-text-primary">{d.addressBilling || "—"}</p>
                          </div>
                        </>
                      ) : (
                        <>
                          <MaskedField label="เลขผู้เสียภาษี"  value={d.taxId}       onUnmask={() => handleUnmask(c._id)} />
                          <MaskedField label="เบอร์โทร"        value={d.phone}       onUnmask={() => handleUnmask(c._id)} />
                          <MaskedField label="อีเมล"           value={d.email}       onUnmask={() => handleUnmask(c._id)} />
                          <div><p className="text-xs text-text-muted">ผู้ประสานงาน</p><p className="text-sm text-text-primary">{d.contactPerson || "—"}</p></div>
                          <div><p className="text-xs text-text-muted">รหัสสาขา</p><p className="text-sm text-text-primary">{d.branchCode || "00000"}</p></div>
                          <div className="col-span-2 sm:col-span-3">
                            <p className="text-xs text-text-muted">ที่อยู่สำนักงาน</p>
                            <p className="text-sm text-text-primary">{d.addressOffice || "—"}</p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
            className="px-3 py-1.5 rounded-xl border border-border-default text-xs text-text-secondary hover:bg-surface-secondary disabled:opacity-40">
            Previous
          </button>
          <span className="text-xs text-text-muted">Page {page} / {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="px-3 py-1.5 rounded-xl border border-border-default text-xs text-text-secondary hover:bg-surface-secondary disabled:opacity-40">
            Next
          </button>
        </div>
      )}

      {showForm && (
        <ClientFormModal
          initial={editItem ? {
            entityType:    editItem.entityType,
            fullName:      editItem.fullName,
            nationalId:    "",
            passport:      "",
            addressBilling:editItem.addressBilling,
            phone:         "",
            email:         "",
            corporateName: editItem.corporateName,
            taxId:         "",
            addressOffice: editItem.addressOffice,
            branchCode:    editItem.branchCode,
            contactPerson: editItem.contactPerson,
          } : undefined}
          editId={editItem?._id}
          onClose={() => { setShowForm(false); setEditItem(null); }}
          onSaved={() => { setShowForm(false); setEditItem(null); loadClients(); }}
        />
      )}
    </div>
  );
}
