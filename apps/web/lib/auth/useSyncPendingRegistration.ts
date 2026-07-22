"use client";

import { getSession, useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

type SyncPhase = "loading" | "ready" | "redirecting";

interface SyncDebug {
  syncOk?: boolean;
  registered?: boolean;
  updateResultRole?: string;
  freshRole?: string;
  error?: string;
}

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
  const [debug, setDebug] = useState<SyncDebug>({});

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
          setDebug((d) => ({ ...d, syncOk: true, registered: data.registered }));
          if (data.registered) {
            // update() with no argument sends a plain GET (next-auth only
            // POSTs — and thus only triggers the server jwt() "update"
            // branch — when called with a defined argument).
            const updateResult = await updateRef.current({});
            const updateResultRole = (updateResult?.user as { role?: string } | undefined)?.role;
            setDebug((d) => ({ ...d, updateResultRole }));
            const fresh = await getSession();
            const freshRole = (fresh?.user as { role?: string } | undefined)?.role;
            setDebug((d) => ({ ...d, freshRole }));
            if (freshRole && freshRole !== "pending") {
              setPhase("redirecting");
              return;
            }
          }
        } else {
          setDebug((d) => ({ ...d, syncOk: false }));
        }
      } catch (err) {
        setDebug((d) => ({ ...d, error: err instanceof Error ? err.message : String(err) }));
      }
      setPhase("ready");
    })();
  }, [status, role]);

  return { session, status, role, phase, debug };
}
