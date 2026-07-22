"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";

function JoinCallback() {
  const searchParams        = useSearchParams();
  const router              = useRouter();
  const { update, status }  = useSession();
  const token               = searchParams.get("token") ?? "";
  const [error, setError]   = useState("");

  useEffect(() => {
    // Wait until session is loaded
    if (status === "loading") return;

    if (status === "unauthenticated") {
      router.replace(`/partner/join${token ? `?token=${encodeURIComponent(token)}` : ""}`);
      return;
    }

    if (!token) {
      setError("Missing invite token. Please use the original invite link.");
      return;
    }

    async function completeJoin() {
      try {
        const res = await fetch("/api/partner/join", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ token }),
        });
        const data = await res.json();

        if (!res.ok) {
          if (data.error === "email_mismatch") {
            setError(`Please sign in with the invited email: ${data.inviteEmail}`);
          } else if (data.error === "already_joined") {
            // Already activated — just redirect.
            // update() needs a defined argument to actually POST.
            await update({});
            window.location.replace("/partner/overview");
          } else if (data.error === "token_expired") {
            setError("This invite has expired. Please ask your admin to resend the invite.");
          } else if (data.error === "invalid_token") {
            setError("Invalid invite link. Please use the link from your invite email.");
          } else {
            setError("Something went wrong. Please try again.");
          }
          return;
        }

        // Refresh session so middleware sees partner_admin role.
        // update() needs a defined argument to actually POST.
        await update({});
        window.location.replace("/partner/overview");
      } catch {
        setError("Network error. Please try again.");
      }
    }

    completeJoin();
  }, [status, token, router, update]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-secondary px-4">
        <div className="bg-surface-primary rounded-2xl shadow-lg p-10 max-w-sm w-full text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-text-primary mb-2">Could Not Activate Account</h2>
          <p className="text-sm text-text-muted mb-6">{error}</p>
          <button
            onClick={async () => {
              await fetch("/api/user/self", { method: "DELETE" }).catch(() => {});
              await signOut({ callbackUrl: "/login" });
            }}
            className="text-sm text-brand-600 hover:underline cursor-pointer"
          >
            Back to login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-secondary">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-text-muted">Setting up your partner account…</p>
      </div>
    </div>
  );
}

export default function PartnerJoinCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-surface-secondary">
        <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <JoinCallback />
    </Suspense>
  );
}
