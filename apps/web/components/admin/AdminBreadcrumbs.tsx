"use client";

import Link from "next/link";
import { confirmLeaveWhenDirty } from "@/lib/admin/unsavedChanges";

type Crumb = {
  label: string;
  href?: string;
};

type AdminBreadcrumbsProps = {
  items: Crumb[];
  isDirty?: boolean;
};

export function AdminBreadcrumbs({ items, isDirty = false }: AdminBreadcrumbsProps) {
  return (
    <nav className="text-sm font-medium text-zinc-500 mb-4" aria-label="Breadcrumb">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        return (
          <span key={`${item.label}-${index}`}>
            {index > 0 && <span className="mx-2 text-zinc-400">&gt;</span>}
            {isLast || !item.href ? (
              <span className={isLast ? "text-zinc-900 font-semibold" : undefined}>{item.label}</span>
            ) : (
              <Link
                href={item.href}
                onClick={(event) => {
                  if (!confirmLeaveWhenDirty(isDirty)) {
                    event.preventDefault();
                  }
                }}
                className="hover:text-blue-600 transition-colors"
              >
                {item.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
