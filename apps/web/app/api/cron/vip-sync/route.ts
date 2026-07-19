/**
 * POST /api/cron/vip-sync
 *
 * Daily cron — keeps User.isVip and User.botState in sync with VipTenant records.
 *
 * Steps:
 *   1. Expire VipTenant records whose endDate has passed (set isActive=false).
 *   2. Sync every unique email that appears in the VipTenant collection.
 *      - Active, non-expired VIP → User.botState="active", isVip=true, vipExpiresAt=endDate
 *      - No active VIP           → User.isVip=false, vipExpiresAt cleared
 *
 * Protected by INTERNAL_CRON_SECRET header.
 * Vercel cron schedule (vercel.json): "0 1 * * *"  →  01:00 UTC daily
 */

import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { VipTenantModel } from "@/lib/db/models/VipTenant";
import { expireAndSyncVipTenants, syncVipStatus } from "@/lib/services/srv_vip_sync";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.INTERNAL_CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  await connectDB();

  // Step 1 — expire overdue records and sync their emails
  const expiredEmails = await expireAndSyncVipTenants();

  // Step 2 — sync all remaining unique emails (covers newly-started VIPs)
  const allVips = await VipTenantModel.find({}).select("email").lean() as { email: string }[];
  const allEmails = Array.from(
    new Set(allVips.map((v) => v.email).filter((e) => !expiredEmails.includes(e))),
  );

  const results = await Promise.allSettled(allEmails.map((e) => syncVipStatus(e)));
  const synced   = results.filter((r) => r.status === "fulfilled").length;
  const failed   = results.filter((r) => r.status === "rejected").length;

  return NextResponse.json({
    ok:      true,
    expired: expiredEmails.length,
    synced:  synced + expiredEmails.length,
    failed,
  });
}
