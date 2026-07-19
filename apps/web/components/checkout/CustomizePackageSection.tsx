"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils/cn";

// ── Public types ────────────────────────────────────────────────────────────────

/**
 * One selectable add-on, sourced from CostPriceScenario via /api/checkout/validate.
 * Price shown to the customer is ALWAYS `bestPriceZudobot` (Final Price Zudobot Retail).
 * Internal production cost (the AR cost column) is never sent to the client and must
 * never be shown here.
 */
export interface CheckoutAddonOption {
  _id:                 string; // scenario ObjectId — sent to backend for re-pricing
  label:               string;
  category:            string; // "AI Base" | "Storage Add-on" | "Expired Add-on" | ...
  bestPriceZudobot:    number; // ✅ retail price to display
  packageDescription?: string;
}

interface Props {
  /** Add-ons from validate API (`data.addonPlans`). May be empty. */
  addonOptions: CheckoutAddonOption[];
  /** Emits the currently-selected add-ons (one per category) whenever selection changes. */
  onChange?: (selected: CheckoutAddonOption[]) => void;
}

// ── Category presentation (display-only; unknown categories fall back gracefully) ──

const CATEGORY_META: Record<string, { icon: string; title: string }> = {
  "AI Base":        { icon: "🤖", title: "AI Base — โควต้าข้อความ" },
  "Storage Add-on": { icon: "💾", title: "Storage Add-on — พื้นที่จัดเก็บ" },
  "Expired Add-on": { icon: "📅", title: "Memory Expired Add-on — ระยะเก็บบทสนทนา" },
  Trial:            { icon: "🎁", title: "Trial — ทดลองใช้" },
};

function categoryMeta(category: string) {
  return CATEGORY_META[category] ?? { icon: "✨", title: category };
}

function thb(n: number) {
  if (n <= 0) return "ฟรี";
  return `฿${n.toLocaleString("th-TH")}/เดือน`;
}

// ── Radio card ──────────────────────────────────────────────────────────────────

function RadioCard({
  selected,
  onClick,
  label,
  price,
  note,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
  price: number;
  note?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-all",
        selected
          ? "border-brand-500 bg-brand-50 ring-1 ring-brand-200"
          : "border-border-default hover:border-brand-300 hover:bg-surface-secondary",
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center",
            selected ? "border-brand-600 bg-brand-600" : "border-zinc-300",
          )}
        >
          {selected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
        </div>
        <div>
          <p className="text-sm font-medium text-text-primary">{label}</p>
          {note && <p className="text-xs text-text-muted">{note}</p>}
        </div>
      </div>
      <span
        className={cn(
          "text-sm font-bold shrink-0 ml-4",
          selected ? "text-brand-600" : "text-text-secondary",
        )}
      >
        {thb(price)}
      </span>
    </button>
  );
}

// ── Main component ───────────────────────────────────────────────────────────────

export function CustomizePackageSection({ addonOptions, onChange }: Props) {
  // selection: category → selected scenario _id ("" / absent = none in that category)
  const [selectedByCategory, setSelectedByCategory] = useState<Record<string, string>>({});

  // Group options by category, preserving the order they arrive from the API
  // (validate already sorts by category then price).
  const groups = useMemo(() => {
    const map = new Map<string, CheckoutAddonOption[]>();
    for (const o of addonOptions) {
      const list = map.get(o.category) ?? [];
      list.push(o);
      map.set(o.category, list);
    }
    return Array.from(map.entries());
  }, [addonOptions]);

  const selectedOptions = useMemo(
    () => addonOptions.filter((o) => selectedByCategory[o.category] === o._id),
    [addonOptions, selectedByCategory],
  );
  const total = selectedOptions.reduce((s, o) => s + o.bestPriceZudobot, 0);

  function selectOption(category: string, id: string) {
    const next = { ...selectedByCategory };
    if (next[category] === id) delete next[category]; // click again → deselect
    else next[category] = id;
    setSelectedByCategory(next);
    onChange?.(addonOptions.filter((o) => next[o.category] === o._id));
  }

  return (
    <div className="rounded-xl border border-border-default bg-white p-6 space-y-6">
      {/* Header */}
      <div>
        <h2 className="font-bold text-text-primary text-base">
          ✨ Your Own Customize Package
        </h2>
        <p className="text-xs text-text-muted mt-0.5">
          เลือกเฉพาะสิ่งที่ต้องการ — ราคาจาก Final Price Zudobot Retail (คลิกซ้ำเพื่อยกเลิก)
        </p>
      </div>

      {/* Empty state — no add-ons available right now */}
      {groups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border-default bg-surface-secondary px-4 py-6 text-center">
          <p className="text-sm text-text-muted">ยังไม่มีแพ็กเกจเสริมให้เลือกในขณะนี้</p>
        </div>
      ) : (
        groups.map(([category, options]) => {
          const meta = categoryMeta(category);
          return (
            <div key={category}>
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">
                {meta.icon} {meta.title}
              </p>
              <div className="space-y-2">
                {options.map((o) => (
                  <RadioCard
                    key={o._id}
                    selected={selectedByCategory[category] === o._id}
                    onClick={() => selectOption(category, o._id)}
                    label={o.label}
                    price={o.bestPriceZudobot}
                    note={o.packageDescription || undefined}
                  />
                ))}
              </div>
            </div>
          );
        })
      )}

      {/* Price summary */}
      {groups.length > 0 && (
        <div className="rounded-xl bg-surface-secondary border border-border-default px-4 py-4 space-y-2 text-sm">
          <p className="font-semibold text-text-primary text-xs uppercase tracking-wide mb-1">
            สรุปแพ็กเกจเสริมที่เลือก (Final Price Zudobot Retail)
          </p>
          {selectedOptions.length === 0 ? (
            <p className="text-text-muted text-xs">ยังไม่ได้เลือกแพ็กเกจเสริม</p>
          ) : (
            selectedOptions.map((o) => (
              <div key={o._id} className="flex justify-between text-text-secondary">
                <span>{o.label}</span>
                <span className="font-mono">+฿{o.bestPriceZudobot.toLocaleString("th-TH")}</span>
              </div>
            ))
          )}
          <div className="border-t border-border pt-2 flex justify-between font-bold text-text-primary">
            <span>รวมแพ็กเกจเสริม</span>
            <span className="font-mono text-brand-600">
              {total > 0 ? `+฿${total.toLocaleString("th-TH")}/เดือน` : "ฟรี"}
            </span>
          </div>
          <p className="text-xs text-text-muted">ยังไม่รวม VAT 7%</p>
        </div>
      )}
    </div>
  );
}
