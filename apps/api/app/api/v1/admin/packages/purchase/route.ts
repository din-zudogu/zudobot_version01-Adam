/**
 * POST /api/v1/admin/packages/purchase
 * Simulates purchasing a package or addon (manual / admin-triggered for now).
 * In production this would be called by the payment webhook after Stripe confirms.
 * Auth: x-secret-key only.
 *
 * Body: { packageSlug: string, amount: number, note?: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, corsHeaders } from "@/lib/middleware/apiKeyAuth";
import dbConnect from "@/lib/db/connect";
import mongoose from "mongoose";
import PackageConfigModel from "@/models/packageConfig";
import TenantUsageModel from "@/models/tenantUsage";
import TenantPurchaseModel from "@/models/tenantPurchase";

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

export async function POST(req: NextRequest) {
  const cors = corsHeaders(req);
  const auth = await authenticateRequest(req);
  if (!auth.ok || auth.keyType !== "secret") {
    return NextResponse.json({ error: "Admin secret key required." }, { status: 403, headers: cors });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: cors });
  }

  const b           = body as Record<string, unknown>;
  const packageSlug = typeof b.packageSlug === "string" ? b.packageSlug.trim() : null;
  const amount      = typeof b.amount === "number" ? b.amount : 0;
  const note        = typeof b.note === "string" ? b.note.slice(0, 200) : "";

  if (!packageSlug) {
    return NextResponse.json({ error: "packageSlug required" }, { status: 400, headers: cors });
  }

  await dbConnect();

  const pkg = await PackageConfigModel.findOne({ slug: packageSlug, isActive: true }).lean();
  if (!pkg) {
    return NextResponse.json({ error: "Package not found or inactive" }, { status: 404, headers: cors });
  }

  const tenantId  = auth.tenant._id;
  const now       = new Date();
  const validFrom = now;
  const validTo   = pkg.billingCycle === "monthly"
    ? new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    : null;

  // Record the purchase
  const purchase = await TenantPurchaseModel.create({
    tenantId, packageSlug, packageName: pkg.name,
    amount, purchasedAt: now, validFrom, validTo, status: "active", note,
  });

  // Apply quota changes to TenantUsage
  const usageUpdate: Record<string, unknown> = {};

  if (pkg.packageType === "BASE_PLAN") {
    usageUpdate.activePackageSlug       = packageSlug;
    usageUpdate.totalMessageQuota       = pkg.messageQuota;
    usageUpdate.totalVisitorMemoryQuota = pkg.visitorMemoryQuota;
    usageUpdate.usedMessages            = 0;
    usageUpdate.cycleStartDate          = now;
    usageUpdate.cycleEndDate            = validTo ?? new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    usageUpdate.lastResetAt             = now;
  } else if (pkg.packageType === "ADDON_MESSAGES") {
    usageUpdate["$inc"] = { totalMessageQuota: pkg.messageQuota };
  } else if (pkg.packageType === "ADDON_MEMORY") {
    usageUpdate["$inc"] = { totalVisitorMemoryQuota: pkg.visitorMemoryQuota };
  }

  // Separate $set from $inc
  const incFields   = usageUpdate["$inc"] as Record<string, number> | undefined;
  const setFields   = { ...usageUpdate };
  delete setFields["$inc"];

  const mongoUpdate: Record<string, unknown> = {};
  if (Object.keys(setFields).length > 0)    mongoUpdate.$set = setFields;
  if (incFields && Object.keys(incFields).length > 0) {
    mongoUpdate.$inc = incFields;
  }

  // Also push addon entry for non-base plans
  if (pkg.packageType !== "BASE_PLAN") {
    mongoUpdate.$push = {
      addons: {
        packageId:    purchase._id,
        packageSlug,
        purchasedAt:  now,
        expiresAt:    validTo,
        quotaGranted: pkg.packageType === "ADDON_MESSAGES" ? pkg.messageQuota : pkg.visitorMemoryQuota,
      },
    };
  }

  await TenantUsageModel.findOneAndUpdate(
    { tenantId: new mongoose.Types.ObjectId(String(tenantId)) },
    mongoUpdate,
    { upsert: true, new: true }
  );

  return NextResponse.json({
    ok: true,
    message: `Package "${pkg.name}" applied successfully.`,
    purchase,
  }, { headers: cors });
}
