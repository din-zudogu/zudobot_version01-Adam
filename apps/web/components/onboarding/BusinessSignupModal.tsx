"use client";

import { useEffect, useMemo, useState } from "react";

export interface BusinessSignupData {
  purposeId: string;
  businessCategoryId: string; // top-level category id (UI grouping only)
  businessSubcategoryId: string; // leaf subcategory id — the value actually saved
  orgName: string;
}

interface MasterItem {
  id: string;
  code: string;
  nameTh: string;
  sortOrder: number;
}
interface CategoryItem extends MasterItem {
  parentId: string | null;
}

export function BusinessSignupStep({
  email,
  data,
  onChange,
}: {
  email?: string | null;
  data: BusinessSignupData;
  onChange: (patch: Partial<BusinessSignupData>) => void;
}) {
  const [purposes, setPurposes] = useState<MasterItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [masterDataError, setMasterDataError] = useState<string | null>(null);
  const [masterDataLoading, setMasterDataLoading] = useState(true);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    (async () => {
      setMasterDataLoading(true);
      setMasterDataError(null);
      try {
        const [pRes, cRes] = await Promise.all([
          fetch("/api/master-data/signup-purposes"),
          fetch("/api/master-data/business-categories"),
        ]);
        if (!pRes.ok || !cRes.ok) {
          setMasterDataError("ไม่สามารถโหลดข้อมูลได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง");
          return;
        }
        const pJson = await pRes.json();
        const cJson = await cRes.json();
        setPurposes(pJson.items ?? []);
        setCategories(cJson.items ?? []);
      } catch {
        setMasterDataError("เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง");
      } finally {
        setMasterDataLoading(false);
      }
    })();
  }, [reloadTick]);

  const topLevelCategories = useMemo(() => categories.filter((c) => !c.parentId), [categories]);
  const subcategories = useMemo(
    () => categories.filter((c) => c.parentId === data.businessCategoryId),
    [categories, data.businessCategoryId]
  );

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-heading text-xl font-bold text-text-primary mb-1">ข้อมูลการสมัครใช้งาน</h2>
        <p className="text-sm text-text-muted">ใช้สร้างบัญชีผู้ใช้งานและร้านค้าของคุณบน ZUDOBOT</p>
      </div>

      {masterDataError && (
        <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 whitespace-pre-wrap break-words flex items-center justify-between gap-3">
          <span>{masterDataError}</span>
          <button
            type="button"
            onClick={() => setReloadTick((t) => t + 1)}
            className="shrink-0 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-colors"
          >
            ลองใหม่
          </button>
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-text-secondary mb-1.5">วัตถุประสงค์การใช้งาน *</label>
        <select
          value={data.purposeId}
          onChange={(e) => onChange({ purposeId: e.target.value })}
          disabled={masterDataLoading}
          className="w-full bg-surface-secondary border border-border-default rounded-xl px-4 py-3 text-sm text-text-primary focus:outline-none focus:border-brand-400 transition-colors disabled:opacity-50"
        >
          <option value="">{masterDataLoading ? "กำลังโหลด..." : "-- เลือกวัตถุประสงค์ --"}</option>
          {purposes.map((p) => (
            <option key={p.id} value={p.id}>{p.nameTh}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-text-secondary mb-1.5">ประเภทธุรกิจ *</label>
        <div className="grid grid-cols-1 gap-2.5">
          <select
            value={data.businessCategoryId}
            onChange={(e) => onChange({ businessCategoryId: e.target.value, businessSubcategoryId: "" })}
            disabled={masterDataLoading}
            className="w-full bg-surface-secondary border border-border-default rounded-xl px-4 py-3 text-sm text-text-primary focus:outline-none focus:border-brand-400 transition-colors disabled:opacity-50"
          >
            <option value="">{masterDataLoading ? "กำลังโหลด..." : "-- เลือกหมวดหมู่ --"}</option>
            {topLevelCategories.map((c) => (
              <option key={c.id} value={c.id}>{c.nameTh}</option>
            ))}
          </select>
          {data.businessCategoryId && (
            <select
              value={data.businessSubcategoryId}
              onChange={(e) => onChange({ businessSubcategoryId: e.target.value })}
              className="w-full bg-surface-secondary border border-border-default rounded-xl px-4 py-3 text-sm text-text-primary focus:outline-none focus:border-brand-400 transition-colors"
            >
              <option value="">-- เลือกประเภทย่อย --</option>
              {subcategories.map((c) => (
                <option key={c.id} value={c.id}>{c.nameTh}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-text-secondary mb-1.5">ชื่อองค์กร *</label>
        <input
          value={data.orgName}
          onChange={(e) => onChange({ orgName: e.target.value.slice(0, 1000) })}
          placeholder="เช่น บริษัท ตัวอย่าง จำกัด"
          maxLength={1000}
          className="w-full bg-surface-secondary border border-border-default rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-400 transition-colors"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-text-secondary mb-1.5">อีเมล์</label>
        <input
          value={email ?? ""}
          readOnly
          className="w-full bg-surface-tertiary border border-border-default rounded-xl px-4 py-3 text-sm text-text-muted cursor-not-allowed"
        />
      </div>
    </div>
  );
}
