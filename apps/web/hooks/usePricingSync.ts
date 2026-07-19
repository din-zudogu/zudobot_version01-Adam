"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  PublicPackage,
  PublicPricingApiResponse,
} from "@/lib/pricing/publicPackageTypes";

export type { PublicPackage } from "@/lib/pricing/publicPackageTypes";

export function usePricingSync(options?: { cycle?: string }) {
  const cycle = options?.cycle ?? "1m";
  const [packages, setPackages] = useState<PublicPackage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncedFromApi, setSyncedFromApi] = useState(false);

  const fetchPricing = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/public/pricing", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      });
      const result = (await response.json()) as PublicPricingApiResponse;
      if (result.success && Array.isArray(result.data)) {
        setPackages(result.data);
        setSyncedFromApi(true);
      } else {
        setError(result.message ?? "load_failed");
      }
    } catch (e) {
      console.error("Failed to sync pricing data:", e);
      setError("network_error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPricing();
  }, [fetchPricing]);

  const monthlyPackages = useMemo(
    () => packages.filter((p) => p.cycle === cycle),
    [packages, cycle]
  );

  const basePlans = useMemo(
    () => monthlyPackages.filter((p) => p.type === "BASE"),
    [monthlyPackages]
  );

  const quotaAddons = useMemo(
    () => monthlyPackages.filter((p) => p.type === "QUOTA_ADDON"),
    [monthlyPackages]
  );

  const retentionAddons = useMemo(
    () => monthlyPackages.filter((p) => p.type === "RETENTION_ADDON"),
    [monthlyPackages]
  );

  /** รวม add-on ทุกประเภท (ตามสเปก addOns) */
  const addOns = useMemo(
    () => monthlyPackages.filter((p) => p.type !== "BASE"),
    [monthlyPackages]
  );

  return {
    packages,
    monthlyPackages,
    basePlans,
    quotaAddons,
    retentionAddons,
    addOns,
    isLoading,
    error,
    syncedFromApi,
    refetch: fetchPricing,
  };
}
