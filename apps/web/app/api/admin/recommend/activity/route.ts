import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { connectDB } from "@/lib/db/connect";
import { UserModel } from "@/lib/db/models/User";
import { TenantProfileModel } from "@/lib/db/models/TenantProfile";
import { ensureReferralMasterData } from "@/lib/db/pg/ensureReferralMasterData";
import { listAllInvites } from "@/lib/db/referral";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = await getServerToken(req);
  if (token?.role !== "super_admin" && token?.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    await Promise.all([connectDB(), ensureReferralMasterData()]);
    const invites = await listAllInvites();

    const tenantIds = Array.from(
      new Set(
        invites.flatMap((i) => [i.referrerTenantId, i.referredTenantId]).filter((id): id is string => !!id)
      )
    );

    const [profiles, users] = await Promise.all([
      TenantProfileModel.find({ tenantId: { $in: tenantIds } }).select("tenantId businessName"),
      UserModel.find({ _id: { $in: tenantIds } }).select("_id email"),
    ]);
    const businessNameByTenantId = new Map(profiles.map((p) => [p.tenantId, p.businessName]));
    const emailByTenantId = new Map(users.map((u) => [u._id.toString(), u.email]));

    const groups = new Map<string, { referrerTenantId: string; referrerEmail: string; referrerShopName: string; invites: typeof invites }>();
    for (const invite of invites) {
      if (!groups.has(invite.referrerTenantId)) {
        groups.set(invite.referrerTenantId, {
          referrerTenantId: invite.referrerTenantId,
          referrerEmail: emailByTenantId.get(invite.referrerTenantId) ?? "",
          referrerShopName: businessNameByTenantId.get(invite.referrerTenantId) ?? "",
          invites: [],
        });
      }
      groups.get(invite.referrerTenantId)!.invites.push(invite);
    }

    return NextResponse.json({
      referrers: Array.from(groups.values()).map((g) => ({
        referrerTenantId: g.referrerTenantId,
        referrerEmail: g.referrerEmail,
        referrerShopName: g.referrerShopName,
        invites: g.invites.map((inv) => ({
          id: inv.id,
          inviteeEmail: inv.inviteeEmail,
          shopName: inv.referredTenantId ? businessNameByTenantId.get(inv.referredTenantId) ?? null : null,
          status: inv.status,
          pointsAwarded: inv.pointsAwarded,
          createdAt: inv.createdAt,
          signedUpAt: inv.signedUpAt,
          installedAt: inv.installedAt,
        })),
      })),
    });
  } catch (err) {
    console.error("[admin/recommend/activity] failed:", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
