"use client";

import { SessionProvider } from "./SessionProvider";
import { LanguageProvider } from "@/lib/i18n";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <LanguageProvider>{children}</LanguageProvider>
    </SessionProvider>
  );
}
