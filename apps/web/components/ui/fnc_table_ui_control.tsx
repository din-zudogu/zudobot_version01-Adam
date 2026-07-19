"use client";

/**
 * fnc_table_ui_control — Zudobot Reusable Admin Table Component
 *
 * Usage:
 *   <fnc_table_ui_control
 *     columns={[{ key:"email", header:"Email" }, ...]}
 *     data={rows}
 *     keyField="_id"
 *     onEdit={row => openModal(row)}
 *     onDelete={row => confirmDelete(row)}
 *   />
 */

import { useMemo, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TableColumnDef<T = object> {
  key: string;
  header: string;
  width?: string;
  align?: "left" | "center" | "right";
  render?: (value: unknown, row: T) => React.ReactNode;
  sortable?: boolean;
}

export interface TableAction<T> {
  label: string;
  icon?: string;
  onClick: (row: T) => void;
  className?: string;
  show?: (row: T) => boolean;
}

export interface FncTableUIControlProps<T extends object> {
  columns: TableColumnDef<T>[];
  data: T[];
  keyField: keyof T;
  loading?: boolean;
  emptyText?: string;
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void;
  actions?: TableAction<T>[];
  pageSize?: number;
  searchPlaceholder?: string;
  searchKeys?: Array<keyof T>;
  className?: string;
}

const PAGE_SIZE_DEFAULT = 15;

// ─── Component ────────────────────────────────────────────────────────────────

function FncTableUIControl<T extends object>({
  columns,
  data,
  keyField,
  loading = false,
  emptyText = "ไม่มีข้อมูล",
  onEdit,
  onDelete,
  actions = [],
  pageSize = PAGE_SIZE_DEFAULT,
  searchPlaceholder = "ค้นหา...",
  searchKeys = [],
  className = "",
}: FncTableUIControlProps<T>) {
  const [search, setSearch]     = useState("");
  const [page, setPage]         = useState(1);
  const [sortKey, setSortKey]   = useState<string | null>(null);
  const [sortAsc, setSortAsc]   = useState(true);

  const hasActions = onEdit || onDelete || actions.length > 0;

  // ── Filter ────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q || searchKeys.length === 0) return data;
    return data.filter((row) => {
      const r = row as Record<string, unknown>;
      return searchKeys.some((k) => String(r[k as string] ?? "").toLowerCase().includes(q));
    });
  }, [data, search, searchKeys]);

  // ── Sort ──────────────────────────────────────────────────────────────────
  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      const ar = a as Record<string, unknown>;
      const br = b as Record<string, unknown>;
      const av = ar[sortKey] ?? "";
      const bv = br[sortKey] ?? "";
      const cmp = String(av).localeCompare(String(bv), "th", { numeric: true });
      return sortAsc ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortAsc]);

  // ── Paginate ──────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageData = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function toggleSort(key: string) {
    if (sortKey === key) setSortAsc((v) => !v);
    else { setSortKey(key); setSortAsc(true); }
    setPage(1);
  }

  function handleSearch(v: string) {
    setSearch(v);
    setPage(1);
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {/* Search bar */}
      {searchKeys.length > 0 && (
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-xs">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">🔍</span>
            <input
              type="text"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full pl-8 pr-3 py-2 text-sm border border-border-default rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-brand-300"
            />
          </div>
          {search && (
            <button
              onClick={() => handleSearch("")}
              className="text-xs text-text-muted hover:text-red-500 transition-colors"
            >
              ล้าง
            </button>
          )}
          <span className="text-xs text-text-muted ml-auto">
            {filtered.length.toLocaleString()} รายการ
          </span>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-border-default overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-secondary border-b border-border-default">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    style={col.width ? { width: col.width } : undefined}
                    className={[
                      "px-4 py-3 font-semibold text-text-secondary text-xs uppercase tracking-wide whitespace-nowrap",
                      col.align === "center" ? "text-center" : col.align === "right" ? "text-right" : "text-left",
                      col.sortable ? "cursor-pointer hover:text-text-primary select-none" : "",
                    ].join(" ")}
                    onClick={() => col.sortable && toggleSort(col.key)}
                  >
                    {col.header}
                    {col.sortable && sortKey === col.key && (
                      <span className="ml-1">{sortAsc ? "↑" : "↓"}</span>
                    )}
                  </th>
                ))}
                {hasActions && (
                  <th className="px-4 py-3 text-right text-xs font-semibold text-text-secondary uppercase tracking-wide">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={columns.length + (hasActions ? 1 : 0)} className="px-4 py-10 text-center text-text-muted text-sm">
                    <span className="inline-block animate-pulse">กำลังโหลด...</span>
                  </td>
                </tr>
              ) : pageData.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + (hasActions ? 1 : 0)} className="px-4 py-10 text-center text-text-muted text-sm">
                    {emptyText}
                  </td>
                </tr>
              ) : (
                pageData.map((row) => (
                  <tr
                    key={String(row[keyField])}
                    className="border-t border-border-default hover:bg-surface-secondary/50 transition-colors"
                  >
                    {columns.map((col) => {
                      const raw = (row as Record<string, unknown>)[col.key];
                      return (
                        <td
                          key={col.key}
                          className={[
                            "px-4 py-3 text-text-primary",
                            col.align === "center" ? "text-center" : col.align === "right" ? "text-right" : "text-left",
                          ].join(" ")}
                        >
                          {col.render ? col.render(raw, row) : String(raw ?? "—")}
                        </td>
                      );
                    })}
                    {hasActions && (
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {actions
                            .filter((a) => !a.show || a.show(row))
                            .map((a, i) => (
                              <button
                                key={i}
                                onClick={() => a.onClick(row)}
                                className={a.className ?? "text-xs px-2.5 py-1.5 rounded-lg border border-border-default text-text-secondary hover:bg-surface-secondary transition-colors"}
                              >
                                {a.icon && <span className="mr-1">{a.icon}</span>}
                                {a.label}
                              </button>
                            ))}
                          {onEdit && (
                            <button
                              onClick={() => onEdit(row)}
                              className="text-xs px-2.5 py-1.5 rounded-lg border border-brand-200 text-brand-600 hover:bg-brand-50 transition-colors"
                            >
                              ✏️ แก้ไข
                            </button>
                          )}
                          {onDelete && (
                            <button
                              onClick={() => onDelete(row)}
                              className="text-xs px-2.5 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
                            >
                              🗑 ลบ
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-text-muted">
          <span>
            หน้า {currentPage} / {totalPages} ({sorted.length.toLocaleString()} รายการ)
          </span>
          <div className="flex gap-1">
            <button
              disabled={currentPage <= 1}
              onClick={() => setPage(1)}
              className="px-2 py-1 rounded border border-border-default disabled:opacity-40 hover:bg-surface-secondary"
            >
              «
            </button>
            <button
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-2 py-1 rounded border border-border-default disabled:opacity-40 hover:bg-surface-secondary"
            >
              ‹
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
              const p = start + i;
              if (p > totalPages) return null;
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={[
                    "px-2.5 py-1 rounded border transition-colors",
                    p === currentPage
                      ? "bg-brand-600 text-white border-brand-600"
                      : "border-border-default hover:bg-surface-secondary",
                  ].join(" ")}
                >
                  {p}
                </button>
              );
            })}
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="px-2 py-1 rounded border border-border-default disabled:opacity-40 hover:bg-surface-secondary"
            >
              ›
            </button>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setPage(totalPages)}
              className="px-2 py-1 rounded border border-border-default disabled:opacity-40 hover:bg-surface-secondary"
            >
              »
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Lowercase alias — preserves naming convention without violating react-hooks/rules-of-hooks
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const fnc_table_ui_control: typeof FncTableUIControl = FncTableUIControl as any;
export { FncTableUIControl };
