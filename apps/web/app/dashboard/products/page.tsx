"use client";

import { useState, useEffect } from "react";

interface Product {
  _id:                string;
  name:               string;
  price:              number;
  priceSuffix:        string;
  shortDescription:   string;
  slug:               string;
  stock:              number | null;
  imageUrl?:          string;
  productUrl?:        string;
  stripePaymentLink?: string;
  isActive:           boolean;
}

const EMPTY: Omit<Product, "_id"> = {
  name: "", price: 0, priceSuffix: "", shortDescription: "",
  slug: "", stock: null, imageUrl: "", productUrl: "", stripePaymentLink: "", isActive: true,
};

function formatPrice(p: number, suffix: string) {
  if (p === -1) return "ติดต่อสอบถาม";
  if (p === 0)  return "ฟรี";
  return `฿${p.toLocaleString("th-TH")}${suffix}`;
}

function Spinner() {
  return <div className="flex items-center justify-center h-64"><div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>;
}

export default function ProductsPage() {
  return <NativeProductsPanel />;
}

function NativeProductsPanel() {
  const [products, setProducts]   = useState<Product[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [editing, setEditing]     = useState<Product | null>(null);
  const [form, setForm]           = useState<Omit<Product, "_id">>(EMPTY);
  const [saving, setSaving]       = useState(false);
  const [deleting, setDeleting]   = useState<string | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const [saved, setSaved]         = useState(false);

  async function load() {
    try {
      const res = await fetch("/api/tenant/products");
      const d   = await res.json() as { products?: Product[] };
      setProducts(d.products ?? []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  function openNew() {
    setEditing(null);
    setForm(EMPTY);
    setError(null);
    setShowForm(true);
  }

  function openEdit(p: Product) {
    setEditing(p);
    setForm({
      name: p.name, price: p.price, priceSuffix: p.priceSuffix,
      shortDescription: p.shortDescription, slug: p.slug, stock: p.stock,
      imageUrl: p.imageUrl ?? "", productUrl: p.productUrl ?? "",
      stripePaymentLink: p.stripePaymentLink ?? "", isActive: p.isActive,
    });
    setError(null);
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.name.trim()) { setError("กรุณากรอกชื่อสินค้า"); return; }
    setSaving(true);
    setError(null);
    try {
      const url    = editing ? `/api/tenant/products/${editing._id}` : "/api/tenant/products";
      const method = editing ? "PUT" : "POST";
      const res    = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          imageUrl:          form.imageUrl?.trim()          || undefined,
          productUrl:        form.productUrl?.trim()        || undefined,
          stripePaymentLink: form.stripePaymentLink?.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(d.error ?? "save_failed");
      }
      setShowForm(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("ลบสินค้านี้?")) return;
    setDeleting(id);
    try {
      await fetch(`/api/tenant/products/${id}`, { method: "DELETE" });
      await load();
    } catch { /* ignore */ }
    finally { setDeleting(null); }
  }

  async function toggleActive(p: Product) {
    await fetch(`/api/tenant/products/${p._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !p.isActive }),
    });
    await load();
  }

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-text-primary">สินค้า</h1>
          <p className="text-sm text-text-muted mt-0.5">
            จัดการสินค้าที่บอทจะแนะนำให้ลูกค้า — {products.length} รายการ
          </p>
        </div>
        <div className="flex items-center gap-3">
          {saved && <span className="text-xs text-green-600 font-medium">✓ บันทึกแล้ว</span>}
          <button
            onClick={openNew}
            className="px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition-colors"
          >
            + เพิ่มสินค้า
          </button>
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg text-text-primary">
                {editing ? "แก้ไขสินค้า" : "เพิ่มสินค้าใหม่"}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-text-muted hover:text-text-primary text-xl leading-none">✕</button>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            {[
              { label: "ชื่อสินค้า *", key: "name", type: "text", placeholder: "เช่น เสื้อยืดสีขาว" },
              { label: "URL รูปภาพ", key: "imageUrl", type: "url", placeholder: "https://..." },
              { label: "URL หน้าสินค้า (ดูรายละเอียด)", key: "productUrl", type: "url", placeholder: "https://yourstore.com/products/..." },
              { label: "Stripe Payment Link (ซื้อเลย)", key: "stripePaymentLink", type: "url", placeholder: "https://buy.stripe.com/..." },
              { label: "Slug (URL path)", key: "slug", type: "text", placeholder: "white-tshirt" },
              { label: "คำอธิบายสั้น", key: "shortDescription", type: "text", placeholder: "อธิบายในประโยคสั้นๆ" },
            ].map(({ label, key, type, placeholder }) => (
              <div key={key}>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5">{label}</label>
                <input
                  type={type}
                  value={(form as Record<string, unknown>)[key] as string ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="w-full bg-surface-secondary border border-border-default rounded-xl px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-brand-400"
                />
              </div>
            ))}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5">ราคา (฿) — ใส่ -1 = ติดต่อสอบถาม</label>
                <input
                  type="number"
                  value={form.price}
                  onChange={(e) => setForm((f) => ({ ...f, price: Number(e.target.value) }))}
                  className="w-full bg-surface-secondary border border-border-default rounded-xl px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-brand-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5">Suffix ราคา</label>
                <input
                  type="text"
                  value={form.priceSuffix}
                  onChange={(e) => setForm((f) => ({ ...f, priceSuffix: e.target.value }))}
                  placeholder="/ชิ้น, /เดือน"
                  className="w-full bg-surface-secondary border border-border-default rounded-xl px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-brand-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">สต็อก (ว่างเปล่า = ไม่จำกัด)</label>
              <input
                type="number"
                value={form.stock ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value === "" ? null : Number(e.target.value) }))}
                placeholder="ไม่จำกัด"
                className="w-full bg-surface-secondary border border-border-default rounded-xl px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-brand-400"
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                className="w-4 h-4 rounded border-border-default"
              />
              <span className="text-sm text-text-primary">เปิดใช้งาน (บอทจะแนะนำสินค้านี้)</span>
            </label>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {saving ? "กำลังบันทึก..." : "บันทึก"}
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="px-5 py-2.5 rounded-xl bg-surface-secondary border border-border-default text-text-secondary text-sm font-semibold hover:border-border-strong transition-colors"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Product List */}
      {products.length === 0 ? (
        <div className="card-premium p-12 text-center">
          <p className="text-4xl mb-3">🛍️</p>
          <p className="text-text-muted text-sm">ยังไม่มีสินค้า — กด &quot;+ เพิ่มสินค้า&quot; เพื่อเริ่ม</p>
          <p className="text-xs text-text-muted mt-1">บอทจะแนะนำสินค้าเหล่านี้โดยอัตโนมัติเมื่อลูกค้าถาม</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <div
              key={p._id}
              className={`card-premium p-4 flex flex-col gap-3 ${!p.isActive ? "opacity-60" : ""}`}
            >
              {/* Image preview */}
              {p.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.imageUrl}
                  alt={p.name}
                  className="w-full h-36 object-cover rounded-xl bg-surface-secondary"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              ) : (
                <div className="w-full h-36 rounded-xl bg-surface-secondary flex items-center justify-center text-4xl">🛍️</div>
              )}

              <div className="flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-sm text-text-primary">{p.name}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${p.isActive ? "bg-green-50 text-green-700" : "bg-surface-secondary text-text-muted"}`}>
                    {p.isActive ? "เปิด" : "ปิด"}
                  </span>
                </div>
                {p.shortDescription && (
                  <p className="text-xs text-text-muted mt-0.5 line-clamp-2">{p.shortDescription}</p>
                )}
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-sm font-bold text-brand-600">{formatPrice(p.price, p.priceSuffix)}</span>
                  {p.stock !== null && (
                    <span className={`text-xs ${p.stock <= 5 ? "text-red-600 font-semibold" : "text-text-muted"}`}>
                      สต็อก {p.stock} ชิ้น{p.stock <= 5 ? " ⚠️" : ""}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => openEdit(p)}
                  className="flex-1 py-1.5 rounded-lg text-xs font-semibold border border-border-default bg-surface-secondary hover:border-brand-400 hover:text-brand-600 transition-colors"
                >
                  แก้ไข
                </button>
                <button
                  onClick={() => toggleActive(p)}
                  className="flex-1 py-1.5 rounded-lg text-xs font-semibold border border-border-default bg-surface-secondary hover:border-amber-400 hover:text-amber-600 transition-colors"
                >
                  {p.isActive ? "ปิด" : "เปิด"}
                </button>
                <button
                  onClick={() => handleDelete(p._id)}
                  disabled={deleting === p._id}
                  className="py-1.5 px-3 rounded-lg text-xs font-semibold border border-red-200 text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  {deleting === p._id ? "..." : "ลบ"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
