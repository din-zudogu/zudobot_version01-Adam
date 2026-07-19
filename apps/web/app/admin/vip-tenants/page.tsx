"use client";

import { useCallback, useEffect, useState } from "react";
import { fnc_table_ui_control, type TableColumnDef } from "@/components/ui/fnc_table_ui_control";
import {
  VipTenantModal,
  type VipTenantDoc,
  type ScenarioOption,
  type VipTenantSavePayload,
} from "@/components/admin/VipTenantModal";
import {
  formatDateTH,
  daysRemaining,
  computeVipStatus,
} from "@/lib/services/srv_expired_date_cal";
import { thb } from "@/lib/pricing/costPriceCalculator";

// ─── Status badge helper ───────────────────────────────────────────────────

function StatusBadge({ vip }: { vip: VipTenantDoc }) {
  const status = computeVipStatus(vip.isActive, vip.endDate);
  const left   = daysRemaining(vip.endDate);

  if (status === "suspended") {
    return <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-500">ระงับ</span>;
  }
  if (status === "expired") {
    return (
      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-600">
        หมดอายุ ({Math.abs(left)} วันที่แล้ว)
      </span>
    );
  }
  if (left <= 7) {
    return (
      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-700">
        ใกล้หมด ({left} วัน)
      </span>
    );
  }
  return (
    <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700">
      Active ({left} วัน)
    </span>
  );
}

// ─── Column definitions ────────────────────────────────────────────────────

const COLUMNS: TableColumnDef<VipTenantDoc>[] = [
  {
    key: "email",
    header: "Email / Tenant",
    sortable: true,
    render: (_, row) => (
      <div>
        <p className="text-sm font-medium text-text-primary">{row.email}</p>
        {row.tenantName && <p className="text-xs text-text-muted">{row.tenantName}</p>}
      </div>
    ),
  },
  {
    key: "label",
    header: "Deal",
    sortable: true,
    render: (v, row) => (
      <div>
        <p className="text-sm text-text-primary">{String(v)}</p>
        {row.note && <p className="text-xs text-text-muted truncate max-w-[160px]">{row.note}</p>}
      </div>
    ),
  },
  {
    key: "baseAiQuota",
    header: "Base AI",
    align: "right",
    render: (v) => <span className="font-mono text-xs">{Number(v).toLocaleString()}</span>,
  },
  {
    key: "storageAddonQuota",
    header: "Storage",
    align: "right",
    render: (v) => <span className="font-mono text-xs">{Number(v).toLocaleString()}</span>,
  },
  {
    key: "expiredAddonQuota",
    header: "Expired",
    align: "right",
    render: (v) => <span className="font-mono text-xs">{Number(v).toLocaleString()}</span>,
  },
  {
    key: "startDate",
    header: "เริ่ม",
    render: (v) => <span className="text-xs whitespace-nowrap">{formatDateTH(v as string)}</span>,
  },
  {
    key: "endDate",
    header: "หมดอายุ",
    render: (_, row) => (
      <div>
        <p className="text-xs whitespace-nowrap">{formatDateTH(row.endDate)}</p>
        <StatusBadge vip={row} />
      </div>
    ),
  },
  {
    key: "customVipPrice",
    header: "ราคา VIP",
    align: "right",
    render: (v, row) => (
      <div className="text-right">
        <p className="text-sm font-semibold text-brand-600 font-mono">{thb(Number(v))}</p>
        <p className="text-[10px] text-text-muted font-mono">ต้นทุน {thb(row.totalCostAr)}</p>
      </div>
    ),
  },
  {
    key: "profitPct",
    header: "กำไร %",
    align: "right",
    render: (v, row) => {
      const pct = Number(v);
      return (
        <span className={`text-xs font-mono font-semibold ${pct >= 0 ? "text-emerald-600" : "text-red-500"}`}>
          {pct.toFixed(1)}%{row.autoRenew ? " 🔄" : ""}
        </span>
      );
    },
  },
];

// ─── Page ──────────────────────────────────────────────────────────────────

export default function AdminVipTenantsPage() {
  const [vips,      setVips]      = useState<VipTenantDoc[]>([]);
  const [scenarios, setScenarios] = useState<ScenarioOption[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [syncing,   setSyncing]   = useState(false);
  const [modal,     setModal]     = useState<"create" | "edit" | null>(null);
  const [editing,   setEditing]   = useState<VipTenantDoc | null>(null);
  const [deleting,  setDeleting]  = useState<VipTenantDoc | null>(null);
  const [toast,     setToast]     = useState<{ msg: string; type: "ok" | "err" } | null>(null);

  function showToast(msg: string, type: "ok" | "err" = "ok") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [vipRes, scenRes] = await Promise.all([
        fetch("/api/admin/vip-tenants"),
        fetch("/api/admin/cost-price"),
      ]);
      const vipData  = await vipRes.json()  as { vips: VipTenantDoc[] };
      const scenData = await scenRes.json() as { scenarios: Array<{ _id: string; label: string; calculated: { totalCostAr: number }; inputs: { plan?: string; packageName?: string } }> };

      setVips(vipData.vips ?? []);
      setScenarios(
        (scenData.scenarios ?? []).map((s) => ({
          _id:         s._id,
          label:       s.label,
          totalCostAr: s.calculated?.totalCostAr ?? 0,
          plan:        s.inputs?.plan,
          packageName: s.inputs?.packageName,
        })),
      );
    } catch {
      showToast("โหลดข้อมูลล้มเหลว", "err");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function handleSave(payload: VipTenantSavePayload) {
    if (modal === "edit" && editing) {
      const res  = await fetch(`/api/admin/vip-tenants/${editing._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { showToast("อัปเดตล้มเหลว", "err"); return; }
      showToast("อัปเดตสำเร็จ ✓");
    } else {
      const res = await fetch("/api/admin/vip-tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { showToast("บันทึกล้มเหลว", "err"); return; }
      showToast("เพิ่ม VIP Tenant สำเร็จ ✓");
    }
    setModal(null);
    setEditing(null);
    void load();
  }

  async function handleSyncAll() {
    setSyncing(true);
    try {
      const res  = await fetch("/api/admin/vip-tenants/sync-all", { method: "POST" });
      const data = await res.json() as { ok?: boolean; synced?: number; expired?: number; error?: string };
      if (!res.ok || !data.ok) { showToast(data.error ?? "Sync ล้มเหลว", "err"); return; }
      showToast(`✓ Sync สำเร็จ — อัปเดต ${data.synced ?? 0} account${data.expired ? ` (หมดอายุ ${data.expired})` : ""}`);
      void load();
    } catch {
      showToast("Sync ล้มเหลว", "err");
    } finally {
      setSyncing(false);
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    const res = await fetch(`/api/admin/vip-tenants/${deleting._id}`, { method: "DELETE" });
    if (!res.ok) { showToast("ลบล้มเหลว", "err"); setDeleting(null); return; }
    showToast("ลบสำเร็จ ✓");
    setDeleting(null);
    void load();
  }

  // Stats bar
  const activeCount   = vips.filter((v) => computeVipStatus(v.isActive, v.endDate) === "active").length;
  const expiredCount  = vips.filter((v) => computeVipStatus(v.isActive, v.endDate) === "expired").length;
  const expiresLater  = vips.filter((v) => {
    const d = daysRemaining(v.endDate);
    return d > 0 && d <= 30 && v.isActive;
  }).length;

  return (
    <div className="space-y-5">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium transition-all ${
          toast.type === "ok" ? "bg-emerald-600 text-white" : "bg-red-500 text-white"
        }`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold font-heading text-text-primary">👑 VIP Tenant</h1>
          <p className="text-sm text-text-muted">จัดการสิทธิ์พิเศษ quota และราคา VIP สำหรับ Tenant คัดเลือก</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void handleSyncAll()}
            disabled={syncing}
            title="อัปเดต User.botState + isVip ให้ตรงกับ VIP records ทั้งหมด"
            className="flex items-center gap-2 px-4 py-2.5 border border-border-default text-sm font-semibold rounded-xl hover:bg-surface-secondary disabled:opacity-50 transition-colors"
          >
            {syncing ? "กำลัง Sync..." : "🔄 Sync VIP Status"}
          </button>
          <button
            onClick={() => { setEditing(null); setModal("create"); }}
            className="flex items-center gap-2 px-4 py-2.5 bg-brand-600 text-white text-sm font-semibold rounded-xl hover:bg-brand-700 transition-colors shadow-sm"
          >
            ➕ เพิ่ม VIP Tenant
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "ทั้งหมด",    value: vips.length,   color: "bg-surface-primary border-border-default",    text: "text-text-primary" },
          { label: "Active",     value: activeCount,   color: "bg-emerald-50 border-emerald-200",           text: "text-emerald-700" },
          { label: "หมดอายุ",   value: expiredCount,  color: "bg-red-50 border-red-200",                   text: "text-red-600" },
          { label: "< 30 วัน",  value: expiresLater,  color: "bg-amber-50 border-amber-200",               text: "text-amber-700" },
        ].map(({ label, value, color, text }) => (
          <div key={label} className={`rounded-xl border px-4 py-3 ${color}`}>
            <p className="text-xs text-text-muted">{label}</p>
            <p className={`text-2xl font-bold font-heading mt-0.5 ${text}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      {fnc_table_ui_control<VipTenantDoc>({
        columns:           COLUMNS,
        data:              vips,
        keyField:          "_id",
        loading,
        emptyText:         "ยังไม่มี VIP Tenant — คลิก ➕ เพื่อเพิ่ม",
        searchKeys:        ["email", "tenantName", "label"],
        searchPlaceholder: "ค้นหา email, ชื่อ tenant, deal...",
        onEdit: (row) => { setEditing(row); setModal("edit"); },
        onDelete: (row) => setDeleting(row),
      })}

      {/* Add/Edit Modal */}
      {modal && (
        <VipTenantModal
          mode={modal}
          initial={editing}
          scenarios={scenarios}
          onSave={handleSave}
          onClose={() => { setModal(null); setEditing(null); }}
        />
      )}

      {/* Delete Confirm */}
      {deleting && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl border border-border-default shadow-card w-full max-w-sm p-6 space-y-4">
            <h3 className="font-heading font-bold text-text-primary text-lg">🗑 ยืนยันการลบ</h3>
            <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              <p className="font-semibold">{deleting.email}</p>
              <p className="text-xs mt-0.5">{deleting.label}</p>
            </div>
            <p className="text-sm text-text-secondary">การลบจะไม่สามารถเรียกคืนได้</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleting(null)}
                className="px-4 py-2 rounded-xl border border-border-default text-sm text-text-secondary">
                ยกเลิก
              </button>
              <button onClick={() => void handleDelete()}
                className="px-4 py-2 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600">
                ลบ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
