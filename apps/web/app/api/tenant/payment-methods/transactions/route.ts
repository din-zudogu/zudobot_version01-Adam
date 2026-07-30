import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { ensurePaymentMasterData } from "@/lib/db/pg/ensurePaymentMasterData";
import { listPaymentTransForTenant } from "@/lib/db/paymentMethods";
import { getSlipImageSignedUrl } from "@/lib/storage/s3";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = await getServerToken(req);
  if (!token?.sub || token.role !== "tenant") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const tenantId = token.sub as string;

  try {
    await ensurePaymentMasterData();
    const rows = await listPaymentTransForTenant(tenantId);

    const transactions = await Promise.all(
      rows.map(async (r) => ({
        id: r.id,
        amountThb: Number(r.amountThb),
        method: r.method,
        status: r.status,
        confidence: r.confidence,
        extractedBankName: r.extractedBankName,
        extractedRef: r.extractedRef,
        extractedDateTime: r.extractedDateTime,
        createdAt: r.createdAt,
        slipUrl: r.slipS3Key ? await getSlipImageSignedUrl(r.slipS3Key).catch(() => null) : null,
      }))
    );

    return NextResponse.json({ transactions });
  } catch (err) {
    console.error("[tenant/payment-methods/transactions GET] failed:", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
