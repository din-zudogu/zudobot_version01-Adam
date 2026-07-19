"use client";

import { signOut as nextAuthSignOut } from "next-auth/react";

/** Clears non-httpOnly Zudo cookies set from the browser. */
export function clearZudoClientCookies(): void {
  for (const name of ["zudo-pdpa-consent"]) {
    document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
  }
}

/** Clears httpOnly onboarding cookies via API, then signs out. */
export async function signOutWithCleanup(callbackUrl: string): Promise<void> {
  clearZudoClientCookies();
  try {
    await fetch("/api/auth/cleanup-cookies", { method: "POST", credentials: "include" });
  } catch {
    // continue with sign-out even if cleanup fails
  }
  await nextAuthSignOut({ callbackUrl });
}
