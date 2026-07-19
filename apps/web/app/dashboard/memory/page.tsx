"use client";

import { useState, useEffect, useCallback } from "react";

interface MemoryData {
  usedBytes:    number;
  usedMb:       number;
  limitMb:      number;
  percent:      number;
  sessionCount: number;
  unlimited:    boolean;
}

function fmtMb(mb: number) {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb.toFixed(1)} MB`;
}
function fmtBytes(b: number) {
  if (b < 1024)          return `${b} B`;
  if (b < 1024 * 1024)   return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(2)} MB`;
}

export default function MemoryPage() {
  const [data, setData]         = useState<MemoryData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [clearing, setClearing] = useState(false);
  const [cleared, setCleared]   = useState("");
  const [confirm, setConfirm]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/tenant/memory");
      const d   = await res.json();
      if (d.error) setError(d.error);
      else setData(d);
    } catch {
      setError("โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function handleClear() {
    setClearing(true);
    setCleared("");
    try {
      const res = await fetch("/api/tenant/memory", { method: "DELETE" });
      const d   = await res.json();
      if (d.ok) {
        setCleared(`ลบ ${d.sessionsDeleted} sessions เรียบร้อย`);
        setConfirm(false);
        void load();
      }
    } catch {
      setError("ลบไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setClearing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm text-text-muted animate-pulse">กำลังโหลด...</div>
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm text-red-500">{error || "ไม่มีข้อมูล"}</p>
      </div>
    );
  }

  const barColor = data.percent >= 90 ? "bg-red-500" : data.percent >= 70 ? "bg-yellow-400" : "bg-brand-500";

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold text-text-primary">Memory</h1>
        <p className="text-sm text-text-muted mt-0.5">จัดการหน่วยความจำการสนทนาของบอท</p>
      </div>

      {/* Usage card */}
      <div className="bg-surface-primary rounded-2xl border border-border-default p-5">
        <p className="text-sm font-semibold text-text-primary mb-4">พื้นที่ที่ใช้</p>

        <div className="flex items-end justify-between mb-2">
          <span className="text-3xl font-bold text-text-primary">{fmtMb(data.usedMb)}</span>
          {data.unlimited ? (
            <span className="text-sm text-text-muted">/ Unlimited</span>
          ) : (
            <span className="text-sm text-text-muted">/ {fmtMb(data.limitMb)}</span>
          )}
        </div>

        {!data.unlimited && (
          <>
            <div className="w-full h-3 rounded-full bg-surface-secondary overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${barColor}`}
                style={{ width: `${data.percent}%` }}
              />
            </div>
            <p className="text-xs text-text-muted mt-2">ใช้ไปแล้ว {data.percent}%</p>
          </>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-surface-primary rounded-2xl border border-border-default p-5">
          <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Sessions</p>
          <p className="text-2xl font-bold text-text-primary">{data.sessionCount.toLocaleString("th-TH")}</p>
          <p className="text-xs text-text-muted mt-0.5">การสนทนาที่บันทึกอยู่</p>
        </div>
        <div className="bg-surface-primary rounded-2xl border border-border-default p-5">
          <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Exact Usage</p>
          <p className="text-2xl font-bold text-text-primary">{fmtBytes(data.usedBytes)}</p>
          <p className="text-xs text-text-muted mt-0.5">พื้นที่จริงที่ใช้</p>
        </div>
      </div>

      {/* Memory info */}
      <div className="bg-surface-primary rounded-2xl border border-border-default p-5">
        <p className="text-sm font-semibold text-text-primary mb-2">เกี่ยวกับ Memory</p>
        <ul className="space-y-1.5 text-xs text-text-secondary">
          <li>• บอทจำประวัติการสนทนาของผู้ใช้แต่ละ Session ไว้เพื่อตอบสนองอย่างต่อเนื่อง</li>
          <li>• Sessions ที่ไม่มีการใช้งานจะถูกลบอัตโนมัติตามระยะเก็บข้อมูลของแพ็กเกจ</li>
          <li>• การล้าง Memory จะลบประวัติสนทนาทั้งหมด — บอทจะเริ่มจำใหม่จากศูนย์</li>
        </ul>
      </div>

      {/* Clear memory */}
      <div className="bg-surface-primary rounded-2xl border border-border-default p-5">
        <p className="text-sm font-semibold text-text-primary mb-1">ล้าง Memory ทั้งหมด</p>
        <p className="text-xs text-text-muted mb-4">
          ลบประวัติการสนทนาทั้งหมดออกจากระบบ — ไม่สามารถกู้คืนได้
        </p>

        {cleared && (
          <p className="text-xs text-green-600 bg-green-50 rounded-xl px-3 py-2 mb-3">{cleared}</p>
        )}

        {!confirm ? (
          <button
            onClick={() => setConfirm(true)}
            disabled={data.sessionCount === 0}
            className="rounded-xl border border-red-300 px-4 py-2 text-sm font-medium text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ล้าง Memory
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <p className="text-xs text-red-500 font-medium">ยืนยันการลบ {data.sessionCount} sessions?</p>
            <button
              onClick={handleClear}
              disabled={clearing}
              className="rounded-xl bg-red-500 px-4 py-2 text-xs font-semibold text-white hover:bg-red-600 transition-colors disabled:opacity-50"
            >
              {clearing ? "กำลังลบ..." : "ยืนยัน"}
            </button>
            <button
              onClick={() => setConfirm(false)}
              className="text-xs text-text-muted hover:text-text-primary transition-colors"
            >
              ยกเลิก
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
