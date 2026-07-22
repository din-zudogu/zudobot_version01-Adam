/**
 * Single place that links a tenant's Subscription to a ReadyPackage and
 * applies that package's own terms (trial duration or lifetime, no expiry).
 * Used both when a tenant actively picks a package at checkout, and when
 * the system auto-switches a tenant to a configured fallback package once
 * their current trial package expires.
 */
import { UserModel } from "@/lib/db/models/User";
import { SubscriptionModel } from "@/lib/db/models/Subscription";
import type { IReadyPackage } from "@/lib/db/models/ReadyPackage";

export async function applyReadyPackageToTenant(
  tenantId: string,
  pkg: Pick<IReadyPackage, "_id" | "name" | "isTrial" | "isLifetime" | "trialDays">,
): Promise<void> {
  const packageId = (pkg._id as { toString(): string }).toString();

  await SubscriptionModel.findOneAndUpdate(
    { tenantId },
    {
      readyPackageId:   packageId,
      readyPackageName: pkg.name,
      ...(pkg.isTrial ? { status: "trialing" } : {}),
    },
    { upsert: true },
  );

  if (pkg.isLifetime) {
    // No expiry check anywhere in the codebase acts unless trialEndsAt is
    // actually set — unsetting it is what makes the package "never expire".
    await UserModel.findByIdAndUpdate(tenantId, {
      botState: "trial",
      $unset: { trialEndsAt: 1 },
    });
  } else if (pkg.isTrial && pkg.trialDays) {
    await UserModel.findByIdAndUpdate(tenantId, {
      botState:    "trial",
      trialEndsAt: new Date(Date.now() + pkg.trialDays * 24 * 60 * 60 * 1000),
    });
  }
}
