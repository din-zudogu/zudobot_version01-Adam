import { cn } from "@/lib/utils/cn";
import type { ReactNode } from "react";

interface BadgeProps {
  children: ReactNode;
  variant?: "blue" | "gold" | "cyan" | "green" | "red" | "muted";
  className?: string;
}

export function Badge({ children, variant = "blue", className }: BadgeProps) {
  const variants = {
    blue:  "bg-brand-50 text-brand-500 border border-brand-100",
    gold:  "bg-gold-50  text-gold-500  border border-gold-100",
    cyan:  "bg-cyan-50  text-cyan-500  border border-cyan-100",
    green: "bg-emerald-50 text-emerald-600 border border-emerald-100",
    red:   "bg-red-50   text-red-600   border border-red-100",
    muted: "bg-surface-secondary text-text-muted border border-[rgba(13,24,41,0.08)]",
  };

  return (
    <span className={cn("inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold tracking-wide", variants[variant], className)}>
      {children}
    </span>
  );
}
