"use client";

import { useState, useEffect, useCallback } from "react";

interface Article {
  _id:           string;
  title:         string;
  slug:          string;
  excerpt:       string;
  content:       string;
  category:      string;
  thumbnail:     string | null;
  status:        "draft" | "published";
  readTimeLabel: string;
  publishedAt:   string | null;
  channels:      string[];
  createdAt:     string;
}

const PRESET_CHANNELS = [
  { value: "www.zudogu.com",        label: "zudogu.com" },
  { value: "www.zudogu.com/trends", label: "zudogu.com/trends" },
  { value: "www.zudobot.zudogu.com",label: "zudobot.zudogu.com" },
];

const EMPTY_FORM = {
  title:         "",
  slug:          "",
  excerpt:       "",
  content:       "",
  category:      "",
  thumbnail:     "",
  readTimeLabel: "",
  status:        "draft" as "draft" | "published",
  channels:      [] as string[],
};

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("th-TH", {
    year: "numeric", month: "short", day: "numeric",
  });
}

export default function ArticlesPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState("");
  const [success,  setSuccess]  = useState("");

  const [showModal,   setShowModal]   = useState(false);
  const [editingId,   setEditingId]   = useState<string | null>(null);
  const [form,        setForm]        = useState(EMPTY_FORM);
  const [deleteId,    setDeleteId]    = useState<string | null>(null);
  const [deleting,    setDeleting]    = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/admin/articles");
      const data = await res.json();
      setArticles(data.articles ?? []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError("");
    setSuccess("");
    setShowModal(true);
  }

  function openEdit(a: Article) {
    setEditingId(a._id);
    setForm({
      title:         a.title,
      slug:          a.slug,
      excerpt:       a.excerpt,
      content:       a.content ?? "",
      category:      a.category,
      thumbnail:     a.thumbnail ?? "",
      readTimeLabel: a.readTimeLabel,
      status:        a.status,
      channels:      a.channels ?? [],
    });
    setError("");
    setSuccess("");
    setShowModal(true);
  }

  function handleTitleChange(title: string) {
    setForm((f) => ({
      ...f,
      title,
      slug: editingId ? f.slug : slugify(title),
    }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!form.title.trim() || !form.excerpt.trim() || !form.category.trim()) {
      setError("กรุณากรอก Title, Excerpt และ Category");
      return;
    }

    setSaving(true);
    try {
      const url    = editingId ? `/api/admin/articles/${editingId}` : "/api/admin/articles";
      const method = editingId ? "PUT" : "POST";
      const res    = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "เกิดข้อผิดพลาด");
        return;
      }

      setSuccess(editingId ? "อัพเดตแล้ว" : "สร้างบทความแล้ว");
      setShowModal(false);
      void load();
    } catch {
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await fetch(`/api/admin/articles/${deleteId}`, { method: "DELETE" });
      setDeleteId(null);
      void load();
    } catch { /* silent */ }
    finally { setDeleting(false); }
  }

  async function toggleStatus(a: Article) {
    const newStatus = a.status === "published" ? "draft" : "published";
    try {
      await fetch(`/api/admin/articles/${a._id}`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ status: newStatus }),
      });
      void load();
    } catch { /* silent */ }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Articles</h1>
          <p className="text-sm text-text-muted mt-0.5">บทความที่แสดงบน Landing Page</p>
        </div>
        <button
          onClick={openCreate}
          className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 transition-colors"
        >
          + บทความใหม่
        </button>
      </div>

      {/* Success/Error toast */}
      {success && (
        <p className="text-xs text-green-600 bg-green-50 rounded-xl px-3 py-2">{success}</p>
      )}

      {/* Table */}
      <div className="bg-surface-primary rounded-2xl border border-border-default overflow-hidden">
        {loading ? (
          <p className="text-sm text-text-muted p-6 animate-pulse">กำลังโหลด...</p>
        ) : articles.length === 0 ? (
          <p className="text-sm text-text-muted p-6">ยังไม่มีบทความ</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border-default bg-surface-secondary">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Title</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Category</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Channels</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">วันที่สร้าง</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border-default">
              {articles.map((a) => (
                <tr key={a._id} className="hover:bg-surface-secondary transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-text-primary leading-snug line-clamp-1">{a.title}</p>
                    <p className="text-xs text-text-muted mt-0.5">{a.slug}</p>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{a.category}</td>
                  <td className="px-4 py-3">
                    {(!a.channels || a.channels.length === 0) ? (
                      <span className="text-xs text-text-muted italic">ทุก Channel</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {a.channels.map((ch) => (
                          <span key={ch} className="inline-block text-xs bg-blue-50 text-blue-700 rounded-full px-2 py-0.5 font-medium">
                            {ch.replace("www.", "")}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleStatus(a)}
                      className={[
                        "inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full transition-colors",
                        a.status === "published"
                          ? "bg-green-100 text-green-700 hover:bg-green-200"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200",
                      ].join(" ")}
                      title="คลิกเพื่อสลับสถานะ"
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${a.status === "published" ? "bg-green-500" : "bg-gray-400"}`} />
                      {a.status === "published" ? "Published" : "Draft"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-xs text-text-muted">{fmtDate(a.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button
                        onClick={() => openEdit(a)}
                        className="text-xs text-brand-600 hover:underline font-medium"
                      >
                        แก้ไข
                      </button>
                      <button
                        onClick={() => setDeleteId(a._id)}
                        className="text-xs text-red-500 hover:underline font-medium"
                      >
                        ลบ
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create/Edit modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl bg-surface-primary rounded-2xl shadow-xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border-default">
              <p className="font-semibold text-text-primary">
                {editingId ? "แก้ไขบทความ" : "บทความใหม่"}
              </p>
              <button onClick={() => setShowModal(false)} className="text-text-muted hover:text-text-primary text-lg">✕</button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  value={form.title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="ชื่อบทความ"
                  className="w-full rounded-xl border border-border-default bg-surface-secondary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              {/* Slug */}
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Slug</label>
                <input
                  value={form.slug}
                  onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                  placeholder="my-article-slug"
                  className="w-full rounded-xl border border-border-default bg-surface-secondary px-3 py-2 text-xs font-mono text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              {/* Excerpt */}
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  Excerpt <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={form.excerpt}
                  onChange={(e) => setForm((f) => ({ ...f, excerpt: e.target.value }))}
                  rows={3}
                  placeholder="คำอธิบายสั้นๆ ที่แสดงในการ์ดบทความ"
                  className="w-full rounded-xl border border-border-default bg-surface-secondary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                />
              </div>

              {/* Category + ReadTime */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                    placeholder="เช่น Education, Deep Dive"
                    className="w-full rounded-xl border border-border-default bg-surface-secondary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Read Time</label>
                  <input
                    value={form.readTimeLabel}
                    onChange={(e) => setForm((f) => ({ ...f, readTimeLabel: e.target.value }))}
                    placeholder="เช่น 5 min read"
                    className="w-full rounded-xl border border-border-default bg-surface-secondary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              {/* Thumbnail */}
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Thumbnail URL</label>
                <input
                  value={form.thumbnail}
                  onChange={(e) => setForm((f) => ({ ...f, thumbnail: e.target.value }))}
                  placeholder="https://..."
                  className="w-full rounded-xl border border-border-default bg-surface-secondary px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              {/* Content */}
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Content (Markdown)</label>
                <textarea
                  value={form.content}
                  onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                  rows={8}
                  placeholder="เนื้อหาบทความ..."
                  className="w-full rounded-xl border border-border-default bg-surface-secondary px-3 py-2 text-xs font-mono text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-500 resize-y"
                />
              </div>

              {/* Channels */}
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-2">
                  Channels
                  <span className="ml-1 text-text-muted font-normal">(ไม่เลือก = แสดงทุก Channel)</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_CHANNELS.map((ch) => {
                    const active = form.channels.includes(ch.value);
                    return (
                      <button
                        key={ch.value}
                        type="button"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            channels: active
                              ? f.channels.filter((c) => c !== ch.value)
                              : [...f.channels, ch.value],
                          }))
                        }
                        className={[
                          "text-xs font-medium px-3 py-1.5 rounded-full border transition-colors",
                          active
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-surface-secondary text-text-secondary border-border-default hover:border-blue-400",
                        ].join(" ")}
                      >
                        {ch.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as "draft" | "published" }))}
                  className="w-full rounded-xl border border-border-default bg-surface-secondary px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </select>
              </div>

              {error && <p className="text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2">{error}</p>}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-xl px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-secondary transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 transition-colors disabled:opacity-50"
                >
                  {saving ? "กำลังบันทึก..." : editingId ? "บันทึก" : "สร้างบทความ"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm bg-surface-primary rounded-2xl shadow-xl p-6 space-y-4">
            <p className="font-semibold text-text-primary">ยืนยันการลบ?</p>
            <p className="text-sm text-text-secondary">บทความนี้จะถูกลบถาวรและไม่สามารถกู้คืนได้</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="rounded-xl px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-secondary"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? "กำลังลบ..." : "ลบ"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
