"use client";

import Link from "next/link";
import { confirmLeaveWhenDirty } from "@/lib/admin/unsavedChanges";

type AdminBackLinkProps = {
  href: string;
  label?: string;
  isDirty?: boolean;
};

export function AdminBackLink({
  href,
  label = "⬅️ ย้อนกลับไปหน้าหลัก",
  isDirty = false,
}: AdminBackLinkProps) {
  return (
    <div className="mb-2">
      <Link
        href={href}
        onClick={(event) => {
          if (!confirmLeaveWhenDirty(isDirty)) {
            event.preventDefault();
          }
        }}
        className="inline-flex items-center text-xs font-bold text-zinc-700 bg-white border border-zinc-200 px-3 py-1.5 rounded-lg hover:bg-zinc-50 transition-colors shadow-sm"
      >
        {label}
      </Link>
    </div>
  );
}
