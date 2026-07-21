/**
 * Shared partner mutation logic — used by both the legacy
 * app/api/admin/partners/[id]/route.ts endpoint and the unified
 * app/api/admin/accounts/[email]/actions/route.ts endpoint.
 */
import { PartnerProfileModel } from "@/lib/db/models/PartnerProfile";
import { SubscriptionModel } from "@/lib/db/models/Subscription";
import { UserModel } from "@/lib/db/models/User";

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

function hasRealUser(partner: { userId?: string }): boolean {
  return !!partner.userId && !partner.userId.startsWith("pending_");
}

export async function softDeletePartner(id: string): Promise<{ ok: true; deletionDate: string } | { ok: false; error: "not_found" }> {
  const partner = await PartnerProfileModel.findById(id);
  if (!partner) return { ok: false, error: "not_found" };

  const deletionDate = new Date(Date.now() + NINETY_DAYS_MS);
  await PartnerProfileModel.findByIdAndUpdate(id, {
    $set: { pendingDeleteAt: deletionDate, status: "suspended" },
  });
  if (hasRealUser(partner)) {
    await UserModel.findByIdAndUpdate(partner.userId, {
      pendingDeleteAt: deletionDate,
      deletedByAdmin:  true,
    });
  }
  return { ok: true, deletionDate: deletionDate.toISOString() };
}

export async function hardDeletePartner(id: string): Promise<{ ok: true } | { ok: false; error: "not_found" }> {
  const partner = await PartnerProfileModel.findById(id);
  if (!partner) return { ok: false, error: "not_found" };

  await SubscriptionModel.updateMany(
    { referredByPartnerId: id },
    { $unset: { referredByPartnerId: 1, partnerStripeAccountId: 1 } }
  );
  await Promise.all([
    PartnerProfileModel.deleteOne({ _id: id }),
    hasRealUser(partner) ? UserModel.deleteOne({ _id: partner.userId }) : Promise.resolve(),
  ]);
  return { ok: true };
}

export async function restorePartner(
  id: string,
): Promise<{ ok: true; message: "already_active" } | { ok: true } | { ok: false; error: "not_found" }> {
  const partner = await PartnerProfileModel.findById(id);
  if (!partner) return { ok: false, error: "not_found" };
  if (!partner.pendingDeleteAt) return { ok: true, message: "already_active" };

  await PartnerProfileModel.findByIdAndUpdate(id, {
    $unset: { pendingDeleteAt: 1 },
    $set:   { status: "active" },
  });
  if (hasRealUser(partner)) {
    await UserModel.findByIdAndUpdate(partner.userId, {
      $unset: { pendingDeleteAt: 1, deletedByAdmin: 1 },
    });
  }
  return { ok: true };
}

export async function setPartnerStatus(
  id: string,
  status: "active" | "suspended",
): Promise<{ ok: true } | { ok: false; error: "not_found" }> {
  const updated = await PartnerProfileModel.findByIdAndUpdate(id, { $set: { status } });
  if (!updated) return { ok: false, error: "not_found" };
  return { ok: true };
}
