/**
 * GET  /api/v1/admin/packages  — list all active packages and addons
 * Auth: x-secret-key only.
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, corsHeaders } from "@/lib/middleware/apiKeyAuth";
import dbConnect from "@/lib/db/connect";
import PackageConfigModel from "@/models/packageConfig";

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

  const packages = await PackageConfigModel
    .find({ isActive: true })
    .sort({ sortOrder: 1, price: 1 })
    .lean();

  const basePlans = packages.filter((p) => p.packageType === "BASE_PLAN");
  const addonMsg  = packages.filter((p) => p.packageType === "ADDON_MESSAGES");
  const addonMem  = packages.filter((p) => p.packageType === "ADDON_MEMORY");

  return NextResponse.json({ ok: true, data: { basePlans, addonMsg, addonMem } }, { headers: cors });
}
