"use client";

import { useEffect, useRef, useState } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

export interface ReadyPackageSummary {
  _id:              string;
  name:             string;
  isOnSale:         boolean;
  isTrial:          boolean;
  finalRetailPrice: number;
  totalMessageQuota: number;
  plans:            string;
}

interface Props {
  /** quota ปัจจุบันที่ set อยู่ใน field baseAiQuota */
  currentQuota: string;
  onSelect: (pkg: ReadyPackageSummary) => void;
  /** CSS class เพิ่มเติม (optional) */
  className?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function thbShort(n: number): string {
  if (n === 0) return "฿0";
  return `฿${n.toLocaleString("th-TH")}`;
}

// ── Component ────────────────────────────────────────────────────────────────

export function QuotaPackageDropdown({ currentQuota, onSelect, className = "" }: Props) {
  const [packages,  setPackages]  = useState<ReadyPackageSummary[]>([]);
  const [filtered,  setFiltered]  = useState<ReadyPackageSummary[]>([]);
  const [search,    setSearch]    = useState("");
  const [open,      setOpen]      = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [fetched,   setFetched]   = useState(false); // ดึงครั้งเดียว
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── ดึงข้อมูลเมื่อ dropdown เปิดครั้งแรก ──────────────────────────────────
  useEffect(() => {
    if (!open || fetched) return;
    setLoading(true);
    fetch("/api/admin/ready-packages")
      .then((r) => r.json())
      .then((data: { packages?: ReadyPackageSummary[] }) => {
        const pkgs = data.packages ?? [];
        setPackages(pkgs);
        setFiltered(pkgs);
        setFetched(true);
      })
      .catch(() => {
        setPackages([]);
        setFiltered([]);
      })
      .finally(() => setLoading(false));
  }, [open, fetched]);

  // ── กรองตาม search ────────────────────────────────────────────────────────
  useEffect(() => {
    const q = search.toLowerCase().trim();
    if (!q) {
      setFiltered(packages);
      return;
    }
    setFiltered(
      packages.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.plans.toLowerCase().includes(q) ||
          String(p.totalMessageQuota).includes(q),
      ),
    );
  }, [search, packages]);

  // ── ปิดเมื่อคลิกนอก ───────────────────────────────────────────────────────
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── focus input เมื่อ dropdown เปิด ──────────────────────────────────────
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  // ── เลือก package ─────────────────────────────────────────────────────────
  function handleSelect(pkg: ReadyPackageSummary) {
    onSelect(pkg);
    setSearch("");
    setOpen(false);
  }

  // ── Badge helper ──────────────────────────────────────────────────────────
  function badge(pkg: ReadyPackageSummary) {
    if (pkg.isTrial)   return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold">Trial</span>;
    if (pkg.isOnSale)  return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold">On Sale</span>;
    return                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 font-semibold">ปิดขาย</span>;
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      {/* Trigger button — แสดง quota ปัจจุบัน */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm border border-border-default rounded-xl bg-surface-secondary hover:bg-white focus:outline-none focus:ring-2 focus:ring-brand-300 transition-colors"
      >
        <span className="text-text-secondary">
          {currentQuota && Number(currentQuota) > 0
            ? <>เลือกแพ็กเกจ — ดู quota ด้านล่าง</>
            : "เลือกจากแพ็กเกจสำเร็จรูป..."}
        </span>
        <svg className={`w-4 h-4 text-text-muted shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute top-[calc(100%+4px)] left-0 right-0 z-[200] bg-white border border-border-default rounded-xl shadow-lg overflow-hidden">

          {/* Search input */}
          <div className="px-3 pt-3 pb-2 border-b border-border-default">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-surface-secondary rounded-lg border border-border-default">
              <svg className="w-3.5 h-3.5 text-text-muted shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ค้นหาชื่อแพ็กเกจ, plan, จำนวน quota..."
                className="flex-1 bg-transparent text-sm outline-none text-text-primary placeholder:text-text-muted"
              />
              {search && (
                <button type="button" onClick={() => setSearch("")}
                  className="text-text-muted hover:text-text-primary text-base leading-none">×</button>
              )}
            </div>
          </div>

          {/* List — max 10 items แล้ว scroll */}
          <div className="overflow-y-auto" style={{ maxHeight: "320px" }}>

            {loading && (
              <div className="px-4 py-6 text-center text-sm text-text-muted">
                <span className="animate-pulse">⏳ กำลังโหลดแพ็กเกจ...</span>
              </div>
            )}

            {!loading && filtered.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-text-muted">
                {search ? `ไม่พบแพ็กเกจที่ค้นหา "${search}"` : "ไม่มีแพ็กเกจที่ใช้งานได้"}
              </div>
            )}

            {!loading && filtered.map((pkg) => (
              <button
                key={pkg._id}
                type="button"
                onClick={() => handleSelect(pkg)}
                className="w-full text-left px-4 py-3 border-b border-border-default last:border-0 hover:bg-surface-secondary transition-colors group"
              >
                {/* Row 1: ชื่อ + badge */}
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-sm font-semibold text-text-primary group-hover:text-brand-600 transition-colors">
                    {pkg.name}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {badge(pkg)}
                    {pkg.finalRetailPrice > 0 && (
                      <span className="text-[10px] font-mono font-bold text-brand-600">
                        {thbShort(pkg.finalRetailPrice)}/เดือน
                      </span>
                    )}
                  </div>
                </div>

                {/* Row 2: plans */}
                {pkg.plans && (
                  <p className="text-xs text-text-muted truncate mb-1">{pkg.plans}</p>
                )}

                {/* Row 3: quota highlight */}
                <div className="flex items-center gap-3 text-[11px]">
                  <span className="text-text-muted">🤖 Base AI Quota:</span>
                  <span className="font-mono font-bold text-brand-600">
                    {pkg.totalMessageQuota.toLocaleString()} msg
                  </span>
                  <span className="text-text-muted ml-auto italic">คลิกเพื่อใช้ quota นี้</span>
                </div>
              </button>
            ))}
          </div>

          {/* Footer count */}
          {!loading && filtered.length > 0 && (
            <div className="px-4 py-2 border-t border-border-default bg-surface-secondary">
              <p className="text-[10px] text-text-muted">
                แสดง {filtered.length} จาก {packages.length} แพ็กเกจ
                {filtered.length > 10 && " — เลื่อนดูเพิ่มเติม"}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}