"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminBackLink } from "@/components/admin/AdminBackLink";
import { AdminBreadcrumbs } from "@/components/admin/AdminBreadcrumbs";

type ViewMode = "tenant" | "partner";

type MonitoringRow = {
  name: string;
  email: string;
  tenantId: string;
  currentPackage: string;
  registeredWebsites: string[];
  partnerRefId?: string;
};

export default function ZudobotMonitoringPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("tenant");
  const [monitoringList, setMonitoringList] = useState<MonitoringRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedRow, setSelectedRow] = useState<MonitoringRow | null>(null);

  const fetchMonitoringData = useCallback(async (mode: ViewMode) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/admin/zudobot/monitoring?viewMode=${mode}`, {
        cache: "no-store",
      });
      const result = (await res.json()) as {
        success?: boolean;
        data?: MonitoringRow[];
        error?: string;
      };
      if (!res.ok || !result.success) {
        throw new Error(result.error ?? "Failed to load monitoring logs");
      }
      setMonitoringList(result.data ?? []);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load monitoring logs";
      setLoadError(message);
      setMonitoringList([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchMonitoringData(viewMode);
  }, [viewMode, fetchMonitoringData]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 bg-[#FAFAFA] min-h-screen">
      <AdminBreadcrumbs
        items={[
          { label: "หน้าหลัก", href: "/admin/tenants" },
          { label: "Zudobot Using Monitoring" },
        ]}
      />

      <AdminBackLink href="/admin/tenants" />

      <div className="bg-white rounded-2xl p-6 border border-zinc-200 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-zinc-900">
              📊 ระบบติดตามการเปิดใช้งานวิดเจ็ตทั่วทั้งระบบ (Using Monitoring)
            </h1>
            <p className="text-xs text-zinc-500 mt-1">
              ตรวจสอบประวัติโครงสร้างการผูกบัญชี เงื่อนไขแพ็กเกจ และโดเมนจริงที่มีการเรียกใช้วิดเจ็ต
            </p>
          </div>

          <div className="inline-flex bg-zinc-100 p-1 rounded-xl border border-zinc-200">
            <button
              type="button"
              onClick={() => setViewMode("tenant")}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === "tenant"
                  ? "bg-white text-zinc-900 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-900"
              }`}
            >
              🏢 ข้อมูลระดับ Tenant บัญชีหลัก
            </button>
            <button
              type="button"
              onClick={() => setViewMode("partner")}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === "partner"
                  ? "bg-white text-zinc-900 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-900"
              }`}
            >
              🤝 พาร์ทเนอร์ และ ลูกค้าของพาร์ทเนอร์
            </button>
          </div>
        </div>

        <div className="overflow-x-auto border border-zinc-200 rounded-xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-200 text-xs font-bold text-zinc-600 uppercase tracking-wider">
                <th className="p-4">ชื่อบัญชี / อีเมลข้อมูลติดต่อ</th>
                <th className="p-4">Tenant ID อ้างอิง</th>
                <th className="p-4">เว็บไซต์ที่ตรวจสอบพบการติดตั้งจริง</th>
                <th className="p-4">เงื่อนไขและข้อกำหนดแพ็กเกจ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 text-sm text-zinc-700">
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-zinc-400 text-xs animate-pulse">
                    กำลังดึงข้อมูลบันทึกความปลอดภัยจากคลาวด์...
                  </td>
                </tr>
              ) : monitoringList.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-zinc-400 text-xs">
                    {loadError ?? "ไม่พบข้อมูลการบันทึกระบบในหมวดหมู่นี้"}
                  </td>
                </tr>
              ) : (
                monitoringList.map((item, idx) => (
                  <tr
                    key={`${item.tenantId}-${idx}`}
                    className="hover:bg-blue-50/50 transition-colors cursor-pointer"
                    onClick={() => setSelectedRow(item)}
                  >
                    <td className="p-4">
                      <div className="font-semibold text-zinc-900">{item.name}</div>
                      <div className="text-xs text-zinc-400">{item.email}</div>
                    </td>
                    <td className="p-4 font-mono text-xs text-purple-600 font-semibold">
                      {item.tenantId}
                    </td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {item.registeredWebsites.length > 0 ? (
                          item.registeredWebsites.map((url, i) => (
                            <span
                              key={`${url}-${i}`}
                              className="text-[11px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-100 font-medium"
                            >
                              🟢 {url}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-zinc-400 italic">
                            ยังตรวจไม่พบตำแหน่งติดตั้ง
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-block px-2.5 py-1 text-xs font-bold rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                          {item.currentPackage || "Standard Tier"}
                        </span>
                        <button type="button" className="text-xs text-blue-600 hover:underline shrink-0">ดูรายละเอียด →</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Detail Panel ─────────────────────────────────────────────── */}
      {selectedRow && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-end z-50" onClick={() => setSelectedRow(null)}>
          <div
            className="bg-white h-full w-full max-w-lg shadow-2xl overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-zinc-200 px-6 py-4 flex items-start justify-between">
              <div>
                <h2 className="font-bold text-zinc-900 text-lg">{selectedRow.name}</h2>
                <p className="text-xs text-zinc-500">{selectedRow.email}</p>
              </div>
              <button type="button" onClick={() => setSelectedRow(null)} className="text-zinc-400 hover:text-zinc-700 text-xl">×</button>
            </div>

            <div className="px-6 py-5 space-y-6 text-sm">
              {/* View mode badge */}
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                  viewMode === "tenant"
                    ? "bg-blue-100 text-blue-700"
                    : "bg-emerald-100 text-emerald-700"
                }`}>
                  {viewMode === "tenant" ? "🏢 Tenant View" : "🤝 Partner View"}
                </span>
                {selectedRow.partnerRefId && (
                  <span className="text-xs text-zinc-500">Partner: <span className="font-mono text-purple-600">{selectedRow.partnerRefId}</span></span>
                )}
              </div>

              {/* Tenant ID */}
              <div className="rounded-xl border border-zinc-200 p-4 space-y-1">
                <p className="text-xs text-zinc-500 font-medium uppercase tracking-wide">Tenant ID</p>
                <p className="font-mono text-xs text-purple-700 break-all">{selectedRow.tenantId}</p>
              </div>

              {/* Package */}
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-xs text-amber-600 font-semibold uppercase tracking-wide mb-1">แพ็กเกจที่ใช้งาน</p>
                <p className="font-bold text-amber-900">{selectedRow.currentPackage || "Standard Tier"}</p>
                <p className="text-xs text-amber-600 mt-1">Plan/Package เสริม: — (ยังไม่มีข้อมูล)</p>
              </div>

              {/* Installed sites */}
              <div>
                <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wide mb-2">เว็บไซต์ที่ติดตั้ง Zudobot</p>
                {selectedRow.registeredWebsites.length > 0 ? (
                  <div className="space-y-1.5">
                    {selectedRow.registeredWebsites.map((url, i) => (
                      <div key={i} className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2">
                        <span className="text-green-500">🟢</span>
                        <a
                          href={url.startsWith("http") ? url : `https://${url}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline break-all"
                        >
                          {url}
                        </a>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-400 italic">ยังไม่พบการติดตั้ง</p>
                )}
              </div>

              {/* Usage (placeholder — requires subscription data) */}
              <div className="rounded-xl border border-zinc-200 p-4 space-y-3">
                <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wide">การใช้งาน (Quota)</p>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-zinc-500">ข้อความ/เดือน</span>
                    <span className="font-semibold text-zinc-700">— / —</span>
                  </div>
                  <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                    <div className="h-full bg-brand-500 rounded-full" style={{ width: "0%" }} />
                  </div>
                  <p className="text-[10px] text-zinc-400 mt-0.5">ข้อมูลการใช้งานจะแสดงเมื่อเชื่อมต่อกับ subscription system</p>
                </div>
              </div>

              {/* Renewal alert placeholder */}
              <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
                <p className="text-xs text-orange-600 font-semibold mb-1">⏰ การต่ออายุ</p>
                <p className="text-xs text-orange-700">วันหมดอายุ: — (ยังไม่มีข้อมูล subscription)</p>
                <p className="text-[10px] text-orange-500 mt-1">ระบบจะแจ้งเตือนอัตโนมัติเมื่อเหลือ 7 วันก่อนหมดอายุ</p>
              </div>

              {/* Partner info (partner view only) */}
              {viewMode === "partner" && selectedRow.partnerRefId && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-xs text-emerald-700 font-semibold mb-2">🤝 ข้อมูล Partner</p>
                  <p className="text-xs">Partner ID: <span className="font-mono text-emerald-800">{selectedRow.partnerRefId}</span></p>
                  <p className="text-xs text-emerald-600 mt-1">ลูกค้าที่ Partner ดูแล: — (ยังไม่มีข้อมูล)</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
