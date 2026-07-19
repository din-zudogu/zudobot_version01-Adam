/**
 * GET /api/v1/admin/usage
 * Returns current billing cycle usage for the authenticated tenant.
 * Auth: x-secret-key only.
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, corsHeaders } from "@/lib/middleware/apiKeyAuth";
import dbConnect from "@/lib/db/connect";
import TenantUsageModel from "@/models/tenantUsage";
import TenantPurchaseModel from "@/models/tenantPurchase";

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

export async function GET(req: NextRequest) {
  const cors = corsHeaders(req);
  const auth = await authenticateRequest(req);
  if (!auth.ok || auth.keyType !== "secret") {
    return NextResponse.json({ error: "Admin secret key required." }, { status: 403, headers: cors });
  }

  await dbConnect();
  const tenantId = auth.tenant._id;

  const [usage, purchases] = await Promise.all([
    TenantUsageModel.findOne({ tenantId }).lean(),
    TenantPurchaseModel.find({ tenantId, status: "active" })
      .sort({ purchasedAt: -1 })
      .limit(20)
      .lean(),
  ]);

  if (!usage) {
    return NextResponse.json({
      ok: true,
      data: {
        activePackageSlug:       "trial",
        totalMessageQuota:       100,
        usedMessages:            0,
        messageUsagePercent:     0,
        totalVisitorMemoryQuota: 0,
        usedVisitorMemory:       0,
        memoryUsagePercent:      0,
        isMemoryFull:            false,
        cycleStartDate:          null,
        cycleEndDate:            null,
        daysUntilReset:          30,
        addons:                  [],
        purchases:               [],
      },
    }, { headers: cors });
  }

  const now             = new Date();
  const daysUntilReset  = Math.max(0, Math.ceil((usage.cycleEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  const msgPercent      = usage.totalMessageQuota > 0
    ? Math.round((usage.usedMessages / usage.totalMessageQuota) * 100)
    : 0;
  const memPercent      = usage.totalVisitorMemoryQuota > 0
    ? Math.round((usage.usedVisitorMemory / usage.totalVisitorMemoryQuota) * 100)
    : 0;

  return NextResponse.json({
    ok: true,
    data: {
      activePackageSlug:       usage.activePackageSlug,
      totalMessageQuota:       usage.totalMessageQuota,
      usedMessages:            usage.usedMessages,
      messageUsagePercent:     Math.min(100, msgPercent),
      totalVisitorMemoryQuota: usage.totalVisitorMemoryQuota,
      usedVisitorMemory:       usage.usedVisitorMemory,
      memoryUsagePercent:      Math.min(100, memPercent),
      isMemoryFull:            usage.isMemoryFull,
      cycleStartDate:          usage.cycleStartDate,
      cycleEndDate:            usage.cycleEndDate,
      daysUntilReset,
      addons:                  usage.addons,
      purchases,
    },
  }, { headers: cors });
}
