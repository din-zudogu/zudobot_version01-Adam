"use client";

import type { SelectedAddon } from "./CheckoutSummary";

interface AddonPlan {
  _id:              string;
  label:            string;
  plan:             string;
  packageName:      string;
  baseAddon:        string;
  category:         string;
  aiBaseMonths:     number;
  messageCount:     number;
  storageExpireDays?: number;
  bestPriceZudobot: number;
  isBestPriceHighlight: boolean;
  packageDescription: string;
}

interface Props {
  addonPlans:      AddonPlan[];
  selectedAddons:  SelectedAddon[];
  onToggle:        (addon: AddonPlan) => void;
}

const CATEGORY_ICONS: Record<string, string> = {
  "AI Base":       "📱",
  "Storage Add-on":"💾",
  "Expired Add-on":"🗂",
  "Trial":         "🎁",
  "อื่นๆ":         "📦",
};

function thb(n: number) {
  return `฿${n.toLocaleString("th-TH")}`;
}

function addonSpec(addon: AddonPlan): string {
  const parts: string[] = [];
  if (addon.messageCount > 0) parts.push(`${addon.messageCount.toLocaleString("th-TH")} ข้อความ`);
  if (addon.storageExpireDays) parts.push(`เก็บ ${addon.storageExpireDays} วัน`);
  if (addon.aiBaseMonths > 0) parts.push(`${addon.aiBaseMonths === 1 ? "รายเดือน" : `${addon.aiBaseMonths} เดือน`}`);
  return parts.join(" · ");
}

export function AddonSelectionSection({ addonPlans, selectedAddons, onToggle }: Props) {
  if (addonPlans.length === 0) return null;

  // Group by category
  const grouped = addonPlans.reduce<Record<string, AddonPlan[]>>((acc, addon) => {
    const cat = addon.category || "อื่นๆ";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(addon);
    return acc;
  }, {});

  const categoryOrder = ["AI Base", "Storage Add-on", "Expired Add-on", "Trial", "อื่นๆ"];
  const orderedGroups = categoryOrder.filter((c) => grouped[c]).map((c) => ({
    category: c,
    items: grouped[c],
  }));

  const selectedIds = new Set(selectedAddons.map((a) => a._id));

  return (
    <div className="rounded-xl border border-border-default bg-white p-6">
      <div className="mb-4">
        <h2 className="font-bold text-text-primary text-base">Plan &amp; Package เสริม</h2>
        <p className="text-xs text-text-muted mt-0.5">
          เลือกบริการเสริมเพิ่มเติมเพื่อขยายความสามารถของแพ็กเกจหลัก
        </p>
      </div>

      <div className="space-y-5">
        {orderedGroups.map(({ category, items }) => (
          <div key={category}>
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">
              {CATEGORY_ICONS[category] ?? "📦"} {category}
            </p>
            <div className="space-y-2">
              {items.map((addon) => {
                const isSelected = selectedIds.has(addon._id);
                const spec = addonSpec(addon);
                return (
                  <button
                    key={addon._id}
                    type="button"
                    onClick={() => onToggle(addon)}
                    className={`w-full flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-all ${
                      isSelected
                        ? "border-brand-500 bg-brand-50 ring-1 ring-brand-200"
                        : "border-border-default hover:border-brand-300 hover:bg-surface-secondary"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                        isSelected ? "border-brand-600 bg-brand-600" : "border-zinc-300"
                      }`}>
                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-text-primary">
                          {addon.plan}{addon.packageName ? ` · ${addon.packageName}` : ""}
                          {addon.isBestPriceHighlight && (
                            <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-brand-100 text-brand-700 font-bold">★</span>
                          )}
                        </p>
                        {spec && <p className="text-xs text-text-muted">{spec}</p>}
                        {addon.packageDescription && (
                          <p className="text-xs text-text-muted mt-0.5 line-clamp-1">{addon.packageDescription}</p>
                        )}
                      </div>
                    </div>
                    <span className={`text-sm font-bold shrink-0 ml-4 ${isSelected ? "text-brand-600" : "text-text-secondary"}`}>
                      +{thb(addon.bestPriceZudobot)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
