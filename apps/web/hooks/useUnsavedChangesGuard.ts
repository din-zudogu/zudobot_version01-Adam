"use client";

import { useEffect } from "react";
import { UNSAVED_LEAVE_MESSAGE } from "@/lib/admin/unsavedChanges";

export function useUnsavedChangesGuard(isDirty: boolean): void {
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = UNSAVED_LEAVE_MESSAGE;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);
}
