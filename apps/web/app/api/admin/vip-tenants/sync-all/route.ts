/**
 * POST /api/admin/vip-tenants/sync-all
 *
 * Manual admin trigger — re-syncs User.isVip for every email in the VipTenant
 * collection.  Useful after bulk imports or to repair out-of-sync records.
 *
 * Auth: admin or super_admin
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { connectDB } from "@/lib/db/connect";
import { VipTenantModel } from "@/lib/db/models/VipTenant";
import { expireAndSyncVipTenants, syncVipStatus } from "@/lib/services/srv_vip_sync";

function requireAdmin(role?: string) {
  return role === "admin" || role === "super_admin";
}

export async function POST(req: NextRequest) {
  const token = await getServerToken(req);
  if (!requireAdmin(token?.role as string)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  await connectDB();

  // Expire overdue records first
  const expiredEmails = await expireAndSyncVipTenants();

  // Sync all remaining unique emails
  const allVips = await VipTenantModel.find({}).select("email").lean() as { email: string }[];
  const remaining = Array.from(
    new Set(allVips.map((v) => v.email).filter((e) => !expiredEmails.includes(e))),
  );

  const results = await Promise.allSettled(remaining.map((e) => syncVipStatus(e)));

  const details = results.map((r, i) =>
    r.status === "fulfilled"
      ? r.value
      : { email: remaining[i], error: String((r as PromiseRejectedResult).reason) },
  );

  return NextResponse.json({
    ok:      true,
    expired: expiredEmails.length,
    synced:  details.length + expiredEmails.length,
    details,
  });
}
