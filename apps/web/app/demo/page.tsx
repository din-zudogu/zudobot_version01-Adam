import { Suspense } from "react";
import { DemoPageClient } from "./DemoPageClient";

export const metadata = { title: "ทดลองใช้ Zudobot — Interactive Sandbox" };

export default function DemoPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-surface-secondary">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-text-muted">กำลังโหลด Sandbox...</p>
        </div>
      </div>
    }>
      <DemoPageClient />
    </Suspense>
  );
}
