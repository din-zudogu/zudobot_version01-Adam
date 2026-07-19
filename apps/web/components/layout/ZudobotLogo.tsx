import Image from "next/image";
import logoSrc from "../../public/logo.png";
import { cn } from "@/lib/utils/cn";

interface ZudobotLogoProps {
  size?: "sm" | "md" | "lg";
  variant?: "color" | "white";
  className?: string;
}

const SIZE_PX = { sm: 32, md: 40, lg: 48 } as const;

export function ZudobotLogo({ size = "md", variant = "color", className }: ZudobotLogoProps) {
  const px = SIZE_PX[size];

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <Image
        src={logoSrc}
        alt="Zudobot logo"
        width={px}
        height={px}
        priority
        className="flex-shrink-0"
      />

      {/* Wordmark */}
      <div className="flex flex-col leading-none">
        <span
          className={cn(
            "font-heading tracking-tight",
            size === "sm" ? "text-lg" : size === "md" ? "text-xl" : "text-2xl",
            variant === "white" ? "text-white" : "text-text-primary"
          )}
          style={{ fontWeight: 800 }}
        >
          ZUDOBOT
        </span>
        <span
          className={cn(
            "font-body tracking-widest uppercase",
            size === "sm" ? "text-[8px]" : "text-[9px]",
            variant === "white" ? "text-white/60" : "text-text-muted"
          )}
        >
          by ZUDOGU
        </span>
      </div>
    </div>
  );
}
