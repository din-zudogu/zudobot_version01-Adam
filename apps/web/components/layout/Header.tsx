"use client";

import Link from "next/link";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { ZudobotLogo } from "./ZudobotLogo";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";
import { LanguageSwitcher } from "@/components/dashboard/LanguageSwitcher";
import { useLang } from "@/lib/i18n";

export function Header() {
  const [open, setOpen] = useState(false);
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const { t } = useLang();
  const isLoggedIn = status === "authenticated" && !!session?.user;
  const hideAuth = pathname === "/partner-benefit";
  const dashboardHref =
    (session?.user as { role?: string })?.role === "super_admin" ||
    (session?.user as { role?: string })?.role === "admin"
      ? "/admin/tenants"
      : "/dashboard/overview";

  const navLinks = [
    { label: t("header.features"), href: "/#features" },
    { label: t("header.demo"), href: "/demo" },
    { label: t("header.pricing"), href: "/#pricing" },
    { label: t("header.faq"), href: "/#faq" },
  ];

  return (
    <header className="fixed top-0 inset-x-0 z-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-4">
        <nav className="glass-card rounded-2xl px-5 py-3 flex items-center justify-between gap-2">
          <Link href="/" aria-label={t("header.homeAria")}>
            <ZudobotLogo size="sm" />
          </Link>

          {!hideAuth && (
            <ul className="hidden lg:flex items-center gap-1 flex-1 justify-center">
              {navLinks.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="px-4 py-2 rounded-xl text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-secondary transition-all duration-200 i18n-compact"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {!hideAuth && (
            <div className="hidden md:flex items-center gap-2 shrink-0">
              <LanguageSwitcher variant="header" />
              {isLoggedIn ? (
                <Link href={dashboardHref}>
                  <Button variant="primary" size="sm" className="i18n-compact-btn">
                    {t("header.dashboard")}
                  </Button>
                </Link>
              ) : (
                <>
                  <Link href="/login">
                    <Button variant="ghost" size="sm" className="i18n-compact-btn">
                      {t("header.login")}
                    </Button>
                  </Link>
                  <Link href="/register">
                    <Button variant="primary" size="sm" className="i18n-compact-btn">
                      {t("header.register")}
                    </Button>
                  </Link>
                </>
              )}
            </div>
          )}

          <button
            type="button"
            className="md:hidden p-2 rounded-xl hover:bg-surface-secondary transition-colors"
            onClick={() => setOpen(!open)}
            aria-label={t("header.menuToggle")}
          >
            <span className={cn("block w-5 h-0.5 bg-text-primary transition-all duration-300", open && "rotate-45 translate-y-1.5")} />
            <span className={cn("block w-5 h-0.5 bg-text-primary my-1 transition-all duration-300", open && "opacity-0")} />
            <span className={cn("block w-5 h-0.5 bg-text-primary transition-all duration-300", open && "-rotate-45 -translate-y-1.5")} />
          </button>
        </nav>

        {open && (
          <div className="md:hidden mt-2 glass-card rounded-2xl px-5 py-4 flex flex-col gap-2 animate-fade-in">
            <div className="pb-2 border-b border-[rgba(13,24,41,0.08)]">
              <LanguageSwitcher variant="header" />
            </div>
            {!hideAuth &&
              navLinks.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="px-4 py-3 rounded-xl text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-secondary transition-all"
                >
                  {l.label}
                </Link>
              ))}
            {!hideAuth && (
              <div className="border-t border-[rgba(13,24,41,0.08)] pt-3 mt-1 flex flex-col gap-2">
                {isLoggedIn ? (
                  <Link href={dashboardHref} onClick={() => setOpen(false)}>
                    <Button variant="primary" size="sm" className="w-full">
                      {t("header.dashboard")}
                    </Button>
                  </Link>
                ) : (
                  <>
                    <Link href="/login" onClick={() => setOpen(false)}>
                      <Button variant="outline" size="sm" className="w-full">
                        {t("header.login")}
                      </Button>
                    </Link>
                    <Link href="/register" onClick={() => setOpen(false)}>
                      <Button variant="primary" size="sm" className="w-full">
                        {t("header.register")}
                      </Button>
                    </Link>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
