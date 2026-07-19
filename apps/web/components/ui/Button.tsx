"use client";
import { cn } from "@/lib/utils/cn";
import { type ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "gold" | "ghost" | "outline";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading, children, disabled, ...props }, ref) => {
    const base = "inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";

    const variants = {
      primary: "bg-brand-500 hover:bg-brand-600 text-white shadow-brand/30 shadow-md hover:shadow-brand/50 hover:shadow-lg hover:-translate-y-0.5 focus:ring-brand-500",
      gold:    "bg-grad-gold text-white shadow-gold/30 shadow-md hover:shadow-gold/50 hover:shadow-lg hover:-translate-y-0.5 focus:ring-gold-500",
      ghost:   "bg-transparent hover:bg-surface-secondary text-text-primary focus:ring-brand-300",
      outline: "border border-[rgba(13,24,41,0.15)] bg-white hover:bg-surface-secondary text-text-primary focus:ring-brand-300",
    };

    const sizes = {
      sm: "px-4 py-2 text-sm gap-1.5",
      md: "px-6 py-3 text-base gap-2",
      lg: "px-8 py-4 text-lg gap-2.5",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(base, variants[variant], sizes[size], className)}
        {...props}
      >
        {loading && (
          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
export { Button };
