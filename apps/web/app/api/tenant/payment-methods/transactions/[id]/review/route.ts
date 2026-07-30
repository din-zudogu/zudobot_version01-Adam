import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { ensurePaymentMasterData } from "@/lib/db/pg/ensurePaymentMasterData";
import { getPaymentTransById, reviewPaymentTrans } from "@/lib/db/paymentMethods";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const token = await getServerToken(req);
  if (!token?.sub || token.role !== "tenant") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const tenantId = token.sub as string;

  let body: { decision?: "confirmed" | "rejected" };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  if (body.decision !== "confirmed" && body.decision !== "rejected") {
    return NextResponse.json({ error: "invalid_decision" }, { status: 400 });
  }

  try {
    await ensurePaymentMasterData();
    const existing = await getPaymentTransById(params.id, tenantId);
    if (!existing) return NextResponse.json({ error: "not_found" }, { status: 404 });
    if (existing.status !== "pending_review") {
      return NextResponse.json({ error: "already_reviewed" }, { status: 409 });
    }

    const row = await reviewPaymentTrans(params.id, tenantId, body.decision, tenantId);
    return NextResponse.json({ ok: true, transaction: row });
  } catch (err) {
    console.error("[tenant/payment-methods/transactions/review] failed:", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
