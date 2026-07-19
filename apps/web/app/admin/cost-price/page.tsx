"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CostPriceFormModal,
  type CostPriceScenarioDoc,
} from "@/components/admin/CostPriceFormModal";
import {
  ReadyPackageModal,
  type ReadyPackageDoc,
} from "@/components/admin/ReadyPackageModal";
import { thb, type CostPriceInputs } from "@/lib/pricing/costPriceCalculator";
import {
  ftc_calc_auto_prices,
  ftc_build_grouped_summary,
  STANDARD_FEATURES,
} from "@/lib/pricing/readyPackageSpec";

const PLAN_CATEGORY_ORDER = [
  "AI Base",
  "Storage Add-on",
  "Expired Add-on",
  "Trial",
  "อื่นๆ",
] as const;

const CATEGORY_PRIORITY: Record<string, number> = {
  "AI Base": 0,
  "Storage Add-on": 1,
  "Expired Add-on": 2,
  "Trial": 3,
  "อื่นๆ": 4,
};

const SCENARIO_PAGE_SIZE = 10;

function planCategory(plan: string): string {
  const p = plan.toLowerCase();
  if (p.includes("trial")) return "Trial";
  if (p.includes("storage")) return "Storage Add-on";
  if (p.includes("expired")) return "Expired Add-on";
  if (p.includes("ai base") || p === "ai base") return "AI Base";
  return "อื่นๆ";
}

export default function AdminCostPricePage() {
  const [scenarios, setScenarios] = useState<CostPriceScenarioDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<CostPriceScenarioDoc | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importReplace, setImportReplace] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // แพคเกจสำเร็จรูป
  const [readyPackages, setReadyPackages] = useState<ReadyPackageDoc[]>([]);
  const [rpModal, setRpModal] = useState<"create" | "edit" | null>(null);
  const [rpEditing, setRpEditing] = useState<ReadyPackageDoc | null>(null);
  // DELETE confirmation
  const [deletingRp, setDeletingRp] = useState<ReadyPackageDoc | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  // Pagination สำหรับตาราง Plan/Package
  const [scenarioPage, setScenarioPage] = useState(1);
  // Pagination สำหรับตารางแพคเกจสำเร็จรูป
  const [rpPage, setRpPage] = useState(1);
  // Search/filter Plan/Package
  const [scenSearchField, setScenSearchField] = useState<"name" | "storage" | "expired">("name");
  const [scenSearchTerm, setScenSearchTerm]   = useState("");
  // Search/filter ReadyPackage
  const [rpSearchField, setRpSearchField] = useState<"name" | "storage" | "expired">("name");
  const [rpSearchTerm, setRpSearchTerm]   = useState("");

  const load = useCallback(async (keepPage = false) => {
    setLoading(true);
    setError(null);
    try {
      const [scenRes, rpRes] = await Promise.all([
        fetch("/api/admin/cost-price"),
        fetch("/api/admin/ready-package"),
      ]);
      const scenData = await scenRes.json();
      if (!scenRes.ok) throw new Error(scenData.error ?? "load_failed");
      setScenarios(scenData.scenarios ?? []);
      if (!keepPage) setScenarioPage(1);

      if (rpRes.ok) {
        const rpData = await rpRes.json();
        setReadyPackages(rpData.packages ?? []);
        if (!keepPage) setRpPage(1);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "โหลดไม่สำเร็จ");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // primary sort: category order (AI Base → Storage → Expired → Trial)
  // secondary sort: updatedAt desc ภายในหมวดเดียวกัน
  const sortedScenarios = useMemo(() => {
    return [...scenarios].sort((a, b) => {
      const catA = CATEGORY_PRIORITY[planCategory(a.inputs.plan)] ?? 99;
      const catB = CATEGORY_PRIORITY[planCategory(b.inputs.plan)] ?? 99;
      if (catA !== catB) return catA - catB;
      const da = new Date(a.updatedAt ?? a.createdAt ?? 0).getTime();
      const db = new Date(b.updatedAt ?? b.createdAt ?? 0).getTime();
      return db - da;
    });
  }, [scenarios]);

  // กรอง scenarios ตาม search
  const filteredScenarios = useMemo(() => {
    const term = scenSearchTerm.trim().toLowerCase();
    return sortedScenarios.filter((s) => {
      if (scenSearchField === "name") {
        if (!term) return true;
        return (s.inputs.plan + " " + (s.inputs.packageName ?? "")).toLowerCase().includes(term);
      }
      if (scenSearchField === "storage") {
        const isStorage = planCategory(s.inputs.plan) === "Storage Add-on";
        if (!term) return isStorage;
        return isStorage && (s.inputs.plan + " " + (s.inputs.packageName ?? "")).toLowerCase().includes(term);
      }
      if (scenSearchField === "expired") {
        const isExpired = planCategory(s.inputs.plan) === "Expired Add-on";
        if (!term) return isExpired;
        const days = String(s.inputs.storageExpireDays ?? "");
        return isExpired && (days.includes(term) || (s.inputs.plan + " " + (s.inputs.packageName ?? "")).toLowerCase().includes(term));
      }
      return true;
    });
  }, [sortedScenarios, scenSearchField, scenSearchTerm]);

  const scenarioTotalPages = Math.max(1, Math.ceil(filteredScenarios.length / SCENARIO_PAGE_SIZE));

  // หน้าปัจจุบัน (10 รายการ)
  const pagedScenarios = useMemo(() => {
    const start = (scenarioPage - 1) * SCENARIO_PAGE_SIZE;
    return filteredScenarios.slice(start, start + SCENARIO_PAGE_SIZE);
  }, [filteredScenarios, scenarioPage]);

  // นับจำนวนรวมต่อหมวดหมู่ใน filteredScenarios (ใช้แสดงใน header)
  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of filteredScenarios) {
      const cat = planCategory(s.inputs.plan);
      counts.set(cat, (counts.get(cat) ?? 0) + 1);
    }
    return counts;
  }, [filteredScenarios]);

  // primary: sortOrder asc, secondary: updatedAt desc
  const sortedReadyPackages = useMemo(() => {
    return [...readyPackages].sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      const da = new Date(a.updatedAt ?? a.createdAt ?? 0).getTime();
      const db = new Date(b.updatedAt ?? b.createdAt ?? 0).getTime();
      return db - da;
    });
  }, [readyPackages]);

  // กรอง readyPackages ตาม search
  const filteredReadyPackages = useMemo(() => {
    const term = rpSearchTerm.trim().toLowerCase();
    return sortedReadyPackages.filter((rp) => {
      if (rpSearchField === "name") {
        if (!term) return true;
        return rp.name.toLowerCase().includes(term) ||
          rp.items.some((i) => (i.plan + " " + (i.packageName ?? "")).toLowerCase().includes(term));
      }
      if (rpSearchField === "storage") {
        const hasStorage = rp.items.some((i) =>
          (i.plan + " " + (i.packageName ?? "")).toLowerCase().includes("storage"),
        );
        if (!term) return hasStorage;
        return hasStorage && rp.name.toLowerCase().includes(term);
      }
      if (rpSearchField === "expired") {
        const hasExpired = rp.items.some((i) =>
          (i.plan + " " + (i.packageName ?? "")).toLowerCase().includes("expired"),
        );
        if (!term) return hasExpired;
        return hasExpired && rp.name.toLowerCase().includes(term);
      }
      return true;
    });
  }, [sortedReadyPackages, rpSearchField, rpSearchTerm]);

  const rpTotalPages = Math.max(1, Math.ceil(filteredReadyPackages.length / SCENARIO_PAGE_SIZE));

  const pagedReadyPackages = useMemo(() => {
    const start = (rpPage - 1) * SCENARIO_PAGE_SIZE;
    return filteredReadyPackages.slice(start, start + SCENARIO_PAGE_SIZE);
  }, [filteredReadyPackages, rpPage]);

  // จัดกลุ่มเฉพาะรายการในหน้าปัจจุบัน
  const groupedScenarios = useMemo(() => {
    const groups = new Map<string, CostPriceScenarioDoc[]>();
    for (const s of pagedScenarios) {
      const cat = planCategory(s.inputs.plan);
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat)!.push(s);
    }
    return PLAN_CATEGORY_ORDER.filter((c) => groups.has(c)).map((cat) => ({
      category: cat,
      rows: groups.get(cat)!,
    }));
  }, [pagedScenarios]);

  const baseScenarios = useMemo(
    () =>
      scenarios
        .filter((s) => s.inputs.pricingMode === "unit_calc")
        .map((s) => ({
          _id: s._id,
          label: s.label,
          monthlyTotalCost: s.calculated.monthlyTotalCost,
        })),
    [scenarios],
  );

  async function handleSeed(replace = false) {
    if (!confirm(replace ? "ลบข้อมูลเดิมและนำเข้าใหม่จาก Excel baseline?" : "นำเข้าข้อมูลตัวอย่างจาก Excel?")) {
      return;
    }
    setSeeding(true);
    try {
      const res = await fetch("/api/admin/cost-price/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ replace }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "seed_failed");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "นำเข้าไม่สำเร็จ");
    }
    setSeeding(false);
  }

  async function handleSave(payload: {
    label: string;
    packageDescription?: string;
    shareToKnowledgeBase: boolean;
    isBestPriceHighlight: boolean;
    isTrialPackage: boolean;
    isOnSale: boolean;
    isPartnerAllowed: boolean;
    inputs: CostPriceInputs;
    sortOrder: number;
    isActive: boolean;
    referenceScenarioId?: string;
  }) {
    const url =
      modal === "edit" && editing
        ? `/api/admin/cost-price/${editing._id}`
        : "/api/admin/cost-price";
    const method = modal === "edit" ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "save_failed");
    setModal(null);
    setEditing(null);
    await load(true); // keepPage: stay on current page after save
  }

  async function handleDelete(row: CostPriceScenarioDoc) {
    if (!confirm(`ลบ "${row.label}"?`)) return;
    await fetch(`/api/admin/cost-price/${row._id}`, { method: "DELETE" });
    await load(); // reset page after delete
  }

  async function handleExport(format: "csv" | "xlsx") {
    setError(null);
    try {
      const res = await fetch(`/api/admin/cost-price/export?format=${format}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "export_failed");
      }
      const blob = await res.blob();
      const stamp = new Date().toISOString().slice(0, 10);
      const ext = format === "csv" ? "csv" : "xlsx";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `zudobot-cost-price-${stamp}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ส่งออกไม่สำเร็จ");
    }
  }

  async function handleImportFile(file: File) {
    if (
      importReplace &&
      !confirm("นำเข้าไฟล์นี้จะลบข้อมูลเดิมทั้งหมดก่อน — ต้องการดำเนินการต่อหรือไม่?")
    ) {
      return;
    }
    setImporting(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("replace", importReplace ? "true" : "false");
      const res = await fetch("/api/admin/cost-price/import", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "import_failed");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "นำเข้าไม่สำเร็จ");
    }
    setImporting(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // --- ReadyPackage handlers ---
  async function handleRpSave(payload: {
    name: string;
    items: Array<{ scenarioId: string }>;
    finalRetailPrice?: number;
    finalPartnerPrice?: number;
    isActive: boolean;
    isOnSale: boolean;
    isTrial: boolean;
    trialDays?: number;
    sortOrder: number;
  }) {
    const url =
      rpModal === "edit" && rpEditing
        ? `/api/admin/ready-package/${rpEditing._id}`
        : "/api/admin/ready-package";
    const method = rpModal === "edit" ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "save_failed");
    setRpModal(null);
    setRpEditing(null);
    await load(true); // keepPage: stay on current page after save
  }

  async function confirmRpDelete() {
    if (!deletingRp) return;
    await fetch(`/api/admin/ready-package/${deletingRp._id}`, { method: "DELETE" });
    setDeletingRp(null);
    setDeleteConfirmText("");
    await load(); // reset page after delete
  }

  async function handleRpToggle(rp: ReadyPackageDoc, field: "isActive" | "isOnSale") {
    await fetch(`/api/admin/ready-package/${rp._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: !rp[field] }),
    });
    await load(true); // keepPage: toggle stays on same page
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-heading font-bold text-text-primary">
          คำนวณราคาและต้นทุน
        </h1>
        <p className="text-sm text-text-muted mt-1 max-w-2xl">
          สูตรจาก Excel Zudobot_Calculate_Cost&amp;Price — ใช้{" "}
          <code className="text-xs">fnc_zdb_cal_cost_price</code> v1.2.0 (AR, ราคา N/O, VAT, Best Price)
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm px-4 py-3">
          {error}
        </div>
      )}

      {/* ===== แพคเกจสำเร็จรูป ===== */}
      <div>
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div>
            <h2 className="text-base font-semibold text-text-primary">แพคเกจสำเร็จรูป</h2>
            <p className="text-xs text-text-muted mt-0.5">
              เรียงตามเลขลำดับ (น้อย→มาก) — แสดงต่อสาธารณะเฉพาะแพคเกจที่{" "}
              <span className="text-green-700 font-medium">ใช้งาน</span>{" "}
              และ <span className="text-blue-700 font-medium">เปิดขาย</span> เท่านั้น
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={rpSearchField}
              onChange={(e) => { setRpSearchField(e.target.value as "name"|"storage"|"expired"); setRpPage(1); setRpSearchTerm(""); }}
              className="bg-surface-secondary border border-border-default rounded-lg px-3 py-1.5 text-xs"
            >
              <option value="name">ชื่อแพคเกจ</option>
              <option value="storage">มี Storage</option>
              <option value="expired">มี Expired</option>
            </select>
            <input
              type="text"
              placeholder="ค้นหา..."
              value={rpSearchTerm}
              onChange={(e) => { setRpSearchTerm(e.target.value); setRpPage(1); }}
              className="bg-surface-secondary border border-border-default rounded-lg px-3 py-1.5 text-xs w-36"
            />
            {(rpSearchTerm || rpSearchField !== "name") && (
              <button type="button" onClick={() => { setRpSearchTerm(""); setRpSearchField("name"); setRpPage(1); }}
                className="text-xs text-text-muted hover:text-text-primary">✕ ล้าง</button>
            )}
            <button type="button"
              onClick={() => { setRpEditing(null); setRpModal("create"); }}
              className="px-4 py-2 rounded-xl border border-brand-600 text-brand-600 text-sm font-semibold hover:bg-brand-50">
              + สร้างแพคเกจสำเร็จรูป
            </button>
          </div>
        </div>

        <div className="bg-surface-primary border border-border-default rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[1000px]">
              <thead>
                <tr className="bg-surface-secondary text-xs text-text-muted uppercase tracking-wide">
                  <th className="px-4 py-3 text-center w-14">ลำดับ</th>
                  <th className="px-4 py-3 text-left">ชื่อแพคเกจ</th>
                  <th className="px-4 py-3 text-left">สเปค / คำอธิบาย</th>
                  <th className="px-4 py-3 text-right">ราคา Retail</th>
                  <th className="px-4 py-3 text-right">ราคา Partner</th>
                  <th className="px-4 py-3 text-center">การใช้งาน</th>
                  <th className="px-4 py-3 text-center">การขาย</th>
                  <th className="px-4 py-3 text-center">โควต้าร้านค้า</th>
                  <th className="px-4 py-3 text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-text-muted">กำลังโหลด...</td>
                  </tr>
                ) : readyPackages.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-text-muted">
                      ยังไม่มีแพคเกจสำเร็จรูป — กด &quot;+ สร้างแพคเกจสำเร็จรูป&quot;
                    </td>
                  </tr>
                ) : (
                  pagedReadyPackages.map((rp) => {
                    const auto = ftc_calc_auto_prices(rp.items);
                    const displayRetail  = rp.finalRetailPrice  ?? auto.autoRetail;
                    const displayPartner = rp.finalPartnerPrice ?? auto.autoPartner;
                    const isPriceCustom  = rp.finalRetailPrice != null || rp.finalPartnerPrice != null;
                    const grouped = ftc_build_grouped_summary(rp.items);
                    return (
                    <tr key={rp._id} className="border-t border-border-default hover:bg-surface-secondary/30">
                      {/* ลำดับแสดงผล */}
                      <td className="px-4 py-3 text-center align-top">
                        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                          rp.isActive && rp.isOnSale
                            ? "bg-brand-600 text-white"
                            : "bg-surface-secondary text-text-muted border border-border-default"
                        }`}>
                          {rp.sortOrder}
                        </span>
                      </td>

                      {/* ชื่อแพคเกจ */}
                      <td className="px-4 py-3 align-top">
                        <p className="font-semibold text-text-primary">{rp.name}</p>
                        <p className="text-xs text-text-muted mt-0.5">{rp.items.length} Plan/Package</p>
                        {rp.newShopsOnly && (
                          <span className="inline-block mt-1 text-[10px] font-semibold text-purple-700 bg-purple-50 border border-purple-200 rounded-full px-2 py-0.5">
                            เฉพาะร้านใหม่
                          </span>
                        )}
                      </td>

                      {/* สเปค / คำอธิบายรวม */}
                      <td className="px-4 py-3 align-top text-xs max-w-xs">
                        <div className="space-y-0.5">
                          {grouped.map((line, gi) => (
                            <p key={gi} className="text-text-secondary">
                              <span className="mr-1">{line.icon}</span>
                              <span className="font-medium">{line.label}</span>
                              {line.details && <span className="text-text-muted"> — {line.details}</span>}
                            </p>
                          ))}
                          <p className="text-text-muted text-[10px] pt-0.5">
                            ✓ {STANDARD_FEATURES.slice(0, 2).join(" · ")} · ...
                          </p>
                        </div>
                      </td>

                      {/* ราคา Retail (Final) */}
                      <td className="px-4 py-3 text-right align-top">
                        <p className="font-mono font-bold text-brand-600">{thb(displayRetail)}</p>
                        {isPriceCustom && rp.finalRetailPrice != null && (
                          <p className="text-[10px] text-brand-500 mt-0.5">ปรับแล้ว</p>
                        )}
                        {!isPriceCustom && (
                          <p className="text-[10px] text-text-muted mt-0.5">auto</p>
                        )}
                      </td>

                      {/* ราคา Partner (Final) */}
                      <td className="px-4 py-3 text-right align-top">
                        <p className="font-mono font-semibold text-text-secondary">{thb(displayPartner)}</p>
                        {isPriceCustom && rp.finalPartnerPrice != null && (
                          <p className="text-[10px] text-brand-500 mt-0.5">ปรับแล้ว</p>
                        )}
                        {!isPriceCustom && (
                          <p className="text-[10px] text-text-muted mt-0.5">auto</p>
                        )}
                      </td>

                      {/* การใช้งาน toggle */}
                      <td className="px-4 py-3 text-center align-top">
                        <button type="button"
                          onClick={() => void handleRpToggle(rp, "isActive")}
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                            rp.isActive
                              ? "bg-green-100 text-green-700 hover:bg-green-200"
                              : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                          }`}>
                          {rp.isActive ? "ใช้งาน" : "ไม่ใช้งาน"}
                        </button>
                      </td>

                      {/* การขาย toggle */}
                      <td className="px-4 py-3 text-center align-top">
                        <button type="button"
                          onClick={() => void handleRpToggle(rp, "isOnSale")}
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                            rp.isOnSale
                              ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                              : "bg-orange-50 text-orange-500 hover:bg-orange-100"
                          }`}>
                          {rp.isOnSale ? "เปิดขาย" : "ไม่เปิดขาย"}
                        </button>
                      </td>

                      {/* โควต้าร้านค้า */}
                      <td className="px-4 py-3 text-center align-top">
                        {(() => {
                          const used = rp.usedShops ?? 0;
                          const cap  = rp.maxShops ?? 0;
                          if (cap <= 0) {
                            return (
                              <div className="space-y-0.5">
                                <p className="text-xs font-medium text-text-secondary">ไม่จำกัด</p>
                                <p className="text-[10px] text-text-muted">ใช้แล้ว {used.toLocaleString()} ร้าน</p>
                              </div>
                            );
                          }
                          const remaining = Math.max(0, cap - used);
                          const full = used >= cap;
                          return (
                            <div className="space-y-0.5">
                              <p className={`text-xs font-bold ${full ? "text-red-600" : "text-text-primary"}`}>
                                {used.toLocaleString()} / {cap.toLocaleString()}
                              </p>
                              <p className={`text-[10px] font-medium ${full ? "text-red-500" : "text-emerald-600"}`}>
                                {full ? "เต็มโควต้า" : `เหลือ ${remaining.toLocaleString()} ร้าน`}
                              </p>
                            </div>
                          );
                        })()}
                      </td>

                      {/* จัดการ */}
                      <td className="px-4 py-3 text-right align-top space-x-3 whitespace-nowrap">
                        <button type="button"
                          onClick={() => { setRpEditing(rp); setRpModal("edit"); }}
                          className="text-brand-600 hover:underline text-xs font-medium">
                          แก้ไข
                        </button>
                        <button type="button"
                          onClick={() => { setDeletingRp(rp); setDeleteConfirmText(""); }}
                          className="text-red-500 hover:underline text-xs font-medium">
                          ลบ
                        </button>
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination แพคเกจสำเร็จรูป */}
          {filteredReadyPackages.length > SCENARIO_PAGE_SIZE && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border-default text-sm">
              <p className="text-xs text-text-muted">
                แสดง{" "}
                {Math.min((rpPage - 1) * SCENARIO_PAGE_SIZE + 1, filteredReadyPackages.length)}–
                {Math.min(rpPage * SCENARIO_PAGE_SIZE, filteredReadyPackages.length)}{" "}
                จาก {filteredReadyPackages.length} แพคเกจ {rpSearchTerm || rpSearchField !== "name" ? `(กรองจาก ${readyPackages.length})` : "· เรียงตามลำดับ"}
              </p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={rpPage === 1}
                  onClick={() => setRpPage((p) => Math.max(1, p - 1))}
                  className="px-2 py-1 rounded-lg border border-border-default text-xs disabled:opacity-40 hover:bg-surface-secondary"
                >
                  ‹
                </button>
                {Array.from({ length: rpTotalPages }, (_, i) => i + 1).map((p) => {
                  const isActive = p === rpPage;
                  const showPage =
                    p === 1 || p === rpTotalPages || Math.abs(p - rpPage) <= 2;
                  if (!showPage) {
                    const prevShown =
                      p - 1 === 1 || p - 1 === rpTotalPages || Math.abs(p - 1 - rpPage) <= 2;
                    if (!prevShown) return null;
                    return (
                      <span key={`ellipsis-${p}`} className="px-1 text-text-muted text-xs">…</span>
                    );
                  }
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setRpPage(p)}
                      className={`min-w-[28px] px-2 py-1 rounded-lg text-xs border transition-colors ${
                        isActive
                          ? "bg-brand-600 text-white border-brand-600 font-semibold"
                          : "border-border-default hover:bg-surface-secondary"
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
                <button
                  type="button"
                  disabled={rpPage === rpTotalPages}
                  onClick={() => setRpPage((p) => Math.min(rpTotalPages, p + 1))}
                  className="px-2 py-1 rounded-lg border border-border-default text-xs disabled:opacity-40 hover:bg-surface-secondary"
                >
                  ›
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ===== รายการ Plan เสริม ===== */}
      <div>
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <h2 className="text-base font-semibold text-text-primary">รายการ Plan เสริม</h2>
          <div className="flex flex-wrap items-center gap-2">
            {/* Export */}
            <div className="flex flex-wrap gap-2 border border-border-default rounded-xl p-1 bg-surface-secondary">
              <span className="text-xs text-text-muted px-2 self-center">ส่งออก</span>
              <button type="button" onClick={() => void handleExport("csv")}
                className="px-3 py-1.5 rounded-lg border border-border-default text-sm bg-white hover:bg-surface-secondary">
                Export CSV
              </button>
              <button type="button" onClick={() => void handleExport("xlsx")}
                className="px-3 py-1.5 rounded-lg border border-border-default text-sm bg-white hover:bg-surface-secondary">
                Export Excel
              </button>
            </div>
            {/* Import */}
            <div className="flex flex-wrap gap-2 border border-border-default rounded-xl p-1 bg-surface-secondary items-center">
              <span className="text-xs text-text-muted px-2">นำเข้า</span>
              <label className="flex items-center gap-1.5 text-xs text-text-secondary px-2 cursor-pointer">
                <input type="checkbox" checked={importReplace}
                  onChange={(e) => setImportReplace(e.target.checked)} className="accent-brand-600" />
                แทนที่ข้อมูลเดิม
              </label>
              <input ref={fileInputRef} type="file"
                accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleImportFile(f); }} />
              <button type="button" disabled={importing}
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 rounded-lg border border-border-default text-sm bg-white hover:bg-surface-secondary disabled:opacity-50">
                {importing ? "กำลังนำเข้า..." : "Import CSV / Excel"}
              </button>
            </div>
            <button type="button" onClick={() => void handleSeed(false)} disabled={seeding}
              className="px-4 py-2 rounded-xl border border-border-default text-sm hover:bg-surface-secondary">
              {seeding ? "กำลังนำเข้า..." : "Seed ตัวอย่าง"}
            </button>
            {/* Search */}
            <select
              value={scenSearchField}
              onChange={(e) => { setScenSearchField(e.target.value as "name"|"storage"|"expired"); setScenarioPage(1); setScenSearchTerm(""); }}
              className="bg-surface-secondary border border-border-default rounded-lg px-3 py-1.5 text-xs"
            >
              <option value="name">ชื่อ Plan / Package</option>
              <option value="storage">พื้นที่จัดเก็บ (Storage)</option>
              <option value="expired">ระยะเวลาเก็บข้อมูล (Expired)</option>
            </select>
            <input
              type="text"
              placeholder={scenSearchField === "name" ? "ค้นหาชื่อ..." : scenSearchField === "expired" ? "ค้นหาจำนวนวัน..." : "ค้นหา..."}
              value={scenSearchTerm}
              onChange={(e) => { setScenSearchTerm(e.target.value); setScenarioPage(1); }}
              className="bg-surface-secondary border border-border-default rounded-lg px-3 py-1.5 text-xs w-44"
            />
            {(scenSearchTerm || scenSearchField !== "name") && (
              <button type="button" onClick={() => { setScenSearchTerm(""); setScenSearchField("name"); setScenarioPage(1); }}
                className="text-xs text-text-muted hover:text-text-primary">✕ ล้าง</button>
            )}
            <button type="button"
              onClick={() => { setEditing(null); setModal("create"); }}
              className="px-4 py-2 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700">
              + เพิ่มรายการ
            </button>
          </div>
        </div>
        <div className="bg-surface-primary border border-border-default rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[860px]">
              <thead>
                <tr className="bg-surface-secondary text-left text-xs text-text-muted uppercase tracking-wide">
                  <th className="px-4 py-3">ชื่อรายการ</th>
                  <th className="px-4 py-3">ชื่อ Package</th>
                  <th className="px-4 py-3 text-right">ราคาขาย Retail</th>
                  <th className="px-4 py-3 text-right">ราคาขาย Partner</th>
                  <th className="px-4 py-3 text-right">VAT 7%</th>
                  <th className="px-4 py-3 text-right">WHT 3%</th>
                  <th className="px-4 py-3 text-center">Best Price</th>
                  <th className="px-4 py-3 text-center">สถานะ</th>
                  <th className="px-4 py-3 text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-text-muted">
                      กำลังโหลด...
                    </td>
                  </tr>
                ) : scenarios.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-text-muted">
                      ยังไม่มีข้อมูล — กด &quot;Seed ตัวอย่าง&quot; หรือ &quot;+ เพิ่มรายการ&quot;
                    </td>
                  </tr>
                ) : (
                  groupedScenarios.flatMap(({ category, rows }) => [
                    <tr key={`cat-${category}`} className="bg-brand-50/60">
                      <td colSpan={9} className="px-4 py-2 text-xs font-semibold text-brand-800">
                        {category}
                        <span className="font-normal text-brand-600/80 ml-2">
                          ({categoryCounts.get(category) ?? rows.length} รายการ)
                        </span>
                      </td>
                    </tr>,
                    ...rows.map((row) => (
                      <tr key={row._id}
                        className="border-t border-border-default hover:bg-surface-secondary/50">
                        {/* ชื่อรายการ */}
                        <td className="px-4 py-3">
                          <p className="font-semibold text-text-primary">{row.label || row.inputs.plan || "—"}</p>
                          <p className="text-xs text-text-muted mt-0.5">{row.inputs.plan}</p>
                          {row.isTrialPackage && (
                            <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700">
                              Trial
                            </span>
                          )}
                        </td>
                        {/* ชื่อ Package */}
                        <td className="px-4 py-3">
                          <p className="text-text-primary">{row.inputs.packageName || "—"}</p>
                          {row.shareToKnowledgeBase && (
                            <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-700">
                              KB
                            </span>
                          )}
                        </td>
                        {/* ราคาขาย Retail (AC) */}
                        <td className="px-4 py-3 text-right font-mono">
                          {thb(row.inputs.bestPriceZudobot)}
                        </td>
                        {/* ราคาขาย Partner (AD) */}
                        <td className="px-4 py-3 text-right font-mono text-text-secondary">
                          {thb(row.inputs.bestPricePartner)}
                        </td>
                        {/* VAT 7% (W) */}
                        <td className="px-4 py-3 text-right font-mono text-text-muted">
                          {thb(row.calculated.vat7Zudobot)}
                        </td>
                        {/* WHT 3% (Y) */}
                        <td className="px-4 py-3 text-right font-mono text-text-muted">
                          {thb(row.calculated.wht3Zudobot)}
                        </td>
                        {/* Best Price flag (AE) */}
                        <td className="px-4 py-3 text-center">
                          {row.isBestPriceHighlight ? (
                            <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-brand-100 text-brand-700">
                              ★ Best
                            </span>
                          ) : (
                            <span className="text-text-muted text-xs">—</span>
                          )}
                        </td>
                        {/* สถานะ: isActive + isOnSale */}
                        <td className="px-4 py-3 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs ${
                              row.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                            }`}>
                              {row.isActive ? "ใช้งาน" : "ไม่ใช้งาน"}
                            </span>
                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs ${
                              row.isOnSale ? "bg-blue-100 text-blue-700" : "bg-orange-50 text-orange-500"
                            }`}>
                              {row.isOnSale ? "เปิดขาย" : "ไม่เปิดขาย"}
                            </span>
                          </div>
                        </td>
                        {/* จัดการ */}
                        <td className="px-4 py-3 text-right space-x-3 whitespace-nowrap">
                          <button type="button"
                            onClick={() => { setEditing(row); setModal("edit"); }}
                            className="text-brand-600 hover:underline text-xs font-medium">
                            แก้ไข
                          </button>
                          <button type="button"
                            onClick={() => void handleDelete(row)}
                            className="text-red-500 hover:underline text-xs font-medium">
                            ลบ
                          </button>
                        </td>
                      </tr>
                    )),
                  ])
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {filteredScenarios.length > SCENARIO_PAGE_SIZE && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border-default text-sm">
              <p className="text-xs text-text-muted">
                แสดง{" "}
                {Math.min((scenarioPage - 1) * SCENARIO_PAGE_SIZE + 1, filteredScenarios.length)}–
                {Math.min(scenarioPage * SCENARIO_PAGE_SIZE, filteredScenarios.length)}{" "}
                จาก {filteredScenarios.length} รายการ {scenSearchTerm || scenSearchField !== "name" ? `(กรองจาก ${scenarios.length} รายการ)` : "· เรียงตามหมวดหมู่"}
              </p>
              <div className="flex items-center gap-1">
                {/* ก่อนหน้า */}
                <button
                  type="button"
                  disabled={scenarioPage === 1}
                  onClick={() => setScenarioPage((p) => Math.max(1, p - 1))}
                  className="px-2 py-1 rounded-lg border border-border-default text-xs disabled:opacity-40 hover:bg-surface-secondary"
                >
                  ‹
                </button>

                {/* หมายเลขหน้า */}
                {Array.from({ length: scenarioTotalPages }, (_, i) => i + 1).map((p) => {
                  const isActive = p === scenarioPage;
                  const showPage =
                    p === 1 ||
                    p === scenarioTotalPages ||
                    Math.abs(p - scenarioPage) <= 2;
                  if (!showPage) {
                    const prevShown =
                      p - 1 === 1 ||
                      p - 1 === scenarioTotalPages ||
                      Math.abs(p - 1 - scenarioPage) <= 2;
                    if (!prevShown) return null;
                    return (
                      <span key={`ellipsis-${p}`} className="px-1 text-text-muted text-xs">
                        …
                      </span>
                    );
                  }
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setScenarioPage(p)}
                      className={`min-w-[28px] px-2 py-1 rounded-lg text-xs border transition-colors ${
                        isActive
                          ? "bg-brand-600 text-white border-brand-600 font-semibold"
                          : "border-border-default hover:bg-surface-secondary"
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}

                {/* ถัดไป */}
                <button
                  type="button"
                  disabled={scenarioPage === scenarioTotalPages}
                  onClick={() => setScenarioPage((p) => Math.min(scenarioTotalPages, p + 1))}
                  className="px-2 py-1 rounded-lg border border-border-default text-xs disabled:opacity-40 hover:bg-surface-secondary"
                >
                  ›
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Formula reference */}
      <details className="bg-surface-primary border border-border-default rounded-xl p-4 text-sm text-text-secondary">
        <summary className="font-semibold text-text-primary cursor-pointer">
          อธิบายสูตรหลักจาก Excel
        </summary>
        <ul className="mt-3 space-y-1 list-disc pl-5">
          <li>AS = SUM(AT:BD) · AR = ROUNDUP(AS) หรือ AR = $AR$ref × F</li>
          <li>AT:AZ = หน่วยต้นทุน × $BJ$3 (anchor) · BA = BE×AP · BB = BP×BN · BC = BM×AQ</li>
          <li>I = G × AR · N = I + AR · O = N − (N × K) · P = N + (N×3%)</li>
          <li>VAT: AI Base Starter (rows 4–6) ใช้ U×7% · แถวอื่นทั้งหมดใช้ N×7% · AA = P + W</li>
          <li>AG = Best Price Zudobot − Best Price Partner</li>
        </ul>
      </details>

      {/* CostPriceFormModal — keyed so switching create↔edit always remounts fresh */}
      {modal && (
        <CostPriceFormModal
          key={modal === "create" ? "create" : (editing?._id ?? "edit")}
          mode={modal}
          initial={editing}
          baseScenarios={baseScenarios}
          onSave={handleSave}
          onClose={() => { setModal(null); setEditing(null); }}
        />
      )}

      {/* ReadyPackageModal */}
      {rpModal && (
        <ReadyPackageModal
          mode={rpModal}
          initial={rpEditing}
          scenarios={scenarios}
          existingPackages={readyPackages}
          onSave={handleRpSave}
          onClose={() => { setRpModal(null); setRpEditing(null); }}
        />
      )}

      {/* DELETE confirmation modal */}
      {deletingRp && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl border border-border-default shadow-card w-full max-w-md p-6 space-y-4">
            <div>
              <h3 className="font-heading font-bold text-text-primary text-lg">ยืนยันการลบแพคเกจ</h3>
              <p className="text-sm text-text-muted mt-1">
                แพคเกจ: <span className="font-semibold text-text-primary">{deletingRp.name}</span>
              </p>
            </div>

            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800 space-y-1">
              <p className="font-semibold">⚠ การลบไม่สามารถย้อนกลับได้</p>
              <p>รายการ Plan/Package ที่อยู่ในแพคเกจนี้จะไม่ถูกลบ — ลบเฉพาะแพคเกจสำเร็จรูปนี้เท่านั้น</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                พิมพ์ <code className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-mono text-sm">DELETE</code> เพื่อยืนยัน
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="พิมพ์ DELETE ที่นี่"
                className="w-full border border-border-default rounded-lg px-3 py-2 text-sm font-mono"
                autoFocus
              />
              <p className="text-xs text-text-muted mt-1">ต้องพิมพ์มือเท่านั้น — ตรงตัวอักษรพิมพ์ใหญ่</p>
            </div>

            <div className="flex justify-end gap-3 pt-1">
              <button type="button"
                onClick={() => { setDeletingRp(null); setDeleteConfirmText(""); }}
                className="px-4 py-2 rounded-xl border border-border-default text-sm text-text-secondary">
                ยกเลิก
              </button>
              <button type="button"
                disabled={deleteConfirmText !== "DELETE"}
                onClick={() => void confirmRpDelete()}
                className="px-5 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed">
                ลบแพคเกจ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
