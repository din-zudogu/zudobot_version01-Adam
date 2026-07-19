"use client";

import { getSession, useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

type SyncPhase = "loading" | "ready" | "redirecting";

/**
 * Runs at most one sync-registration + session.update() per mount when role is pending.
 * Prevents infinite /api/auth/sync-registration ↔ /api/auth/session loops.
 */
export function useSyncPendingRegistration() {
  const { data: session, status, update } = useSession();
  const syncStarted = useRef(false);
  const updateRef = useRef(update);
  updateRef.current = update;
  const [phase, setPhase] = useState<SyncPhase>("loading");

  const role = (session?.user as { role?: string } | undefined)?.role;

  useEffect(() => {
    if (status === "loading") {
      setPhase("loading");
      return;
    }

    if (status === "unauthenticated") {
      setPhase("ready");
      return;
    }

    if (role !== "pending") {
      setPhase("ready");
      return;
    }

    if (syncStarted.current) {
      return;
    }
    syncStarted.current = true;

    void (async () => {
      try {
        const check = await fetch("/api/auth/sync-registration", {
          credentials: "include",
        });
        if (check.ok) {
          const data = (await check.json()) as { registered?: boolean };
          if (data.registered) {
            await updateRef.current();
            const fresh = await getSession();
            const freshRole = (fresh?.user as { role?: string } | undefined)?.role;
            if (freshRole && freshRole !== "pending") {
              setPhase("redirecting");
              return;
            }
          }
        }
      } catch {
        // fall through — caller shows registration UI
      }
      setPhase("ready");
    })();
  }, [status, role]);

  return { session, status, role, phase };
}
