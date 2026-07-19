"use client";

import { SANDBOX_SCENARIOS, SCENARIO_ORDER } from "./scenarios";
import type { ScenarioId } from "./scenarios";

interface Props {
  active: ScenarioId;
  onChange: (id: ScenarioId) => void;
}

export function ScenarioSwitcher({ active, onChange }: Props) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
      {SCENARIO_ORDER.map((id) => {
        const s = SANDBOX_SCENARIOS[id];
        const isActive = id === active;
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            className={[
              "flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200 border",
              isActive
                ? "bg-brand-600 text-white border-brand-600 shadow-brand"
                : "bg-surface-primary text-text-secondary border-border-default hover:border-brand-400 hover:text-brand-600",
            ].join(" ")}
          >
            <span className="text-base leading-none">{s.icon}</span>
            <span className="hidden sm:inline">{s.label}</span>
          </button>
        );
      })}
    </div>
  );
}
