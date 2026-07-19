"use client";

import { useEffect, useMemo, useState } from "react";

interface CategoryItem {
  id: string;
  code: string;
  nameTh: string;
  parentId: string | null;
  sortOrder: number;
}

function Spinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export default function BusinessInfoPage() {
  const [loading, setLoading] = useState(true);
  const [orgName, setOrgName] = useState("");
  const [businessCategoryId, setBusinessCategoryId] = useState("");
  const [businessTopCategoryId, setBusinessTopCategoryId] = useState("");
  const [categories, setCategories] = useState<CategoryItem[]>([]);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [profileRes, categoriesRes] = await Promise.all([
        fetch("/api/tenant/business"),
        fetch("/api/master-data/business-categories"),
      ]);
      if (profileRes.ok) {
        const p = await profileRes.json();
        setOrgName(p.orgName ?? "");
        setBusinessCategoryId(p.businessCategoryId ?? "");
      }
      if (categoriesRes.ok) {
        const c = await categoriesRes.json();
        setCategories(c.items ?? []);
      }
      setLoading(false);
    })();
  }, []);

  // Once categories + the saved businessCategoryId are both loaded, resolve
  // which top-level category owns it so the cascade shows the right subcategory list.
  useEffect(() => {
    if (!businessCategoryId || categories.length === 0 || businessTopCategoryId) return;
    const leaf = categories.find((c) => c.id === businessCategoryId);
    if (leaf?.parentId) setBusinessTopCategoryId(leaf.parentId);
  }, [businessCategoryId, categories, businessTopCategoryId]);

  const topLevelCategories = useMemo(() => categories.filter((c) => !c.parentId), [categories]);
  const subcategories = useMemo(
    () => categories.filter((c) => c.parentId === businessTopCategoryId),
    [categories, businessTopCategoryId]
  );

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch("/api/tenant/business", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgName, businessCategoryId }),
      });
      if (!res.ok) {
        setError("บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Spinner />;

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="font-heading text-xl font-bold text-text-primary">ข้อมูลธุรกิจ</h1>
      </div>

      <div className="card-premium p-6 space-y-4">
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5">ชื่อองค์กร *</label>
          <input
            value={orgName}
            onChange={(e) => setOrgName(e.target.value.slice(0, 1000))}
            maxLength={1000}
            className="w-full bg-surface-secondary border border-border-default rounded-xl px-4 py-3 text-sm text-text-primary focus:outline-none focus:border-brand-400 transition-colors"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1.5">ประเภทธุรกิจ *</label>
          <div className="grid grid-cols-1 gap-2.5">
            <select
              value={businessTopCategoryId}
              onChange={(e) => { setBusinessTopCategoryId(e.target.value); setBusinessCategoryId(""); }}
              className="w-full bg-surface-secondary border border-border-default rounded-xl px-4 py-3 text-sm text-text-primary focus:outline-none focus:border-brand-400 transition-colors"
            >
              <option value="">-- เลือกหมวดหมู่ --</option>
              {topLevelCategories.map((c) => (
                <option key={c.id} value={c.id}>{c.nameTh}</option>
              ))}
            </select>
            {businessTopCategoryId && (
              <select
                value={businessCategoryId}
                onChange={(e) => setBusinessCategoryId(e.target.value)}
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

        {error && (
          <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
        )}
        {saved && (
          <div className="px-4 py-3 rounded-xl bg-green-50 border border-green-200 text-sm text-green-700">บันทึกสำเร็จ</div>
        )}

        <button
          onClick={handleSave}
          disabled={saving || !orgName.trim() || !businessCategoryId}
          className="px-6 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition-colors disabled:opacity-50"
        >
          {saving ? "กำลังบันทึก..." : "บันทึก"}
        </button>
      </div>
    </div>
  );
}
