"use client";

import Link from "next/link";
import { ZudobotLogo } from "./ZudobotLogo";
import { useLang } from "@/lib/i18n";

export function Footer() {
  const { t } = useLang();

  const links = {
    product: [
      { label: t("footer.features"), href: "/#features" },
      { label: t("footer.pricing"), href: "/pricing" },
      { label: t("footer.sandbox"), href: "/demo" },
      { label: t("footer.apiDocs"), href: "/docs" },
    ],
    company: [
      { label: t("footer.about"), href: "https://www.zudogu.com" },
      { label: t("footer.contact"), href: "mailto:support@zudogu.com" },
    ],
    legal: [
      { label: t("footer.privacy"), href: "/privacy" },
      { label: t("footer.terms"), href: "/terms" },
      { label: t("footer.pdpa"), href: "/privacy#pdpa" },
    ],
  };

  return (
    <footer className="bg-text-primary text-white/70">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          <div className="md:col-span-1">
            <ZudobotLogo variant="white" size="sm" />
            <p className="mt-4 text-sm leading-relaxed text-white/50">
              {t("footer.tagline")}
              <br />
              {t("footer.taglineSub")}
            </p>
            <p className="mt-6 text-xs text-white/30">
              © {new Date().getFullYear()} ZUDOGU Co., Ltd.
              <br />
              {t("footer.rights")}
            </p>
          </div>

          <div>
            <h3 className="text-white font-heading font-semibold text-sm mb-4 tracking-wide">
              {t("footer.product")}
            </h3>
            <ul className="space-y-3">
              {links.product.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm hover:text-white transition-colors duration-200">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-white font-heading font-semibold text-sm mb-4 tracking-wide">
              {t("footer.company")}
            </h3>
            <ul className="space-y-3">
              {links.company.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm hover:text-white transition-colors duration-200">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-white font-heading font-semibold text-sm mb-4 tracking-wide">
              {t("footer.legal")}
            </h3>
            <ul className="space-y-3">
              {links.legal.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm hover:text-white transition-colors duration-200">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}
