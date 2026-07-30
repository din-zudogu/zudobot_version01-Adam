import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { connectDB } from "@/lib/db/connect";
import { TenantProfileModel } from "@/lib/db/models/TenantProfile";
import { ensurePaymentMasterData } from "@/lib/db/pg/ensurePaymentMasterData";
import { listAllPaymentTrans } from "@/lib/db/paymentMethods";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = await getServerToken(req);
  if (token?.role !== "super_admin" && token?.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    await Promise.all([connectDB(), ensurePaymentMasterData()]);
    const rows = await listAllPaymentTrans();

    const tenantIds = Array.from(new Set(rows.map((r) => r.tenantId)));
    const profiles = tenantIds.length
      ? await TenantProfileModel.find({ tenantId: { $in: tenantIds } }).select("tenantId businessName")
      : [];
    const shopNameByTenantId = new Map(profiles.map((p) => [p.tenantId, p.businessName]));

    return NextResponse.json({
      transactions: rows.map((r) => ({
        id: r.id,
        tenantId: r.tenantId,
        shopName: shopNameByTenantId.get(r.tenantId) ?? "—",
        amountThb: Number(r.amountThb),
        method: r.method,
        status: r.status,
        confidence: r.confidence,
        createdAt: r.createdAt,
      })),
    });
  } catch (err) {
    console.error("[admin/payment-transactions] failed:", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
