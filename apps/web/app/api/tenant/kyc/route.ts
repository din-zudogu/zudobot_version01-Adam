import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { connectDB } from "@/lib/db/connect";
import { KycSubmissionModel } from "@/lib/db/models/KycSubmission";
import { UserModel } from "@/lib/db/models/User";
import { logSystemEvent } from "@/lib/logging/systemLogger";

// GET — fetch current tenant's KYC status
export async function GET(req: NextRequest) {
  const token = await getServerToken(req);
  if (!token?.sub || token.role !== "tenant") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    await connectDB();
    const kyc = await KycSubmissionModel.findOne({ tenantId: token.sub }).sort({ createdAt: -1 });
    return NextResponse.json({ kyc: kyc ?? null });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

// POST — submit KYC
export async function POST(req: NextRequest) {
  const token = await getServerToken(req);
  if (!token?.sub || token.role !== "tenant") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const required = ["legalName","taxId","address","province","postalCode","contactName","contactPhone"];
  for (const field of required) {
    if (!body[field]) return NextResponse.json({ error: `missing_field_${field}` }, { status: 400 });
  }

  // Tax ID must be 13 digits
  if (!/^\d{13}$/.test(String(body.taxId))) {
    return NextResponse.json({ error: "invalid_tax_id" }, { status: 400 });
  }

  try {
    await connectDB();

    // Only one pending submission at a time
    const existing = await KycSubmissionModel.findOne({ tenantId: token.sub, status: "pending" });
    if (existing) {
      return NextResponse.json({ error: "pending_submission_exists" }, { status: 409 });
    }

    const kyc = await KycSubmissionModel.create({
      tenantId:     token.sub,
      legalName:    String(body.legalName).trim(),
      taxId:        String(body.taxId).trim(),
      vatRegistered:Boolean(body.vatRegistered),
      address:      String(body.address).trim(),
      province:     String(body.province).trim(),
      postalCode:   String(body.postalCode).trim(),
      contactName:  String(body.contactName).trim(),
      contactPhone: String(body.contactPhone).trim(),
      docBusinessCert:   body.docBusinessCert   ? String(body.docBusinessCert)   : undefined,
      docVatCert:        body.docVatCert        ? String(body.docVatCert)        : undefined,
      docSignedContract: body.docSignedContract ? String(body.docSignedContract) : undefined,
      status:       "pending",
      whtExempt:    false,
      whtRate:      0.03,
    });

    // Move to pending_kyc bot state if enterprise
    const prevUser = await UserModel.findByIdAndUpdate(token.sub, { botState: "pending_kyc" });
    await logSystemEvent({
      category: "bot_state", action: "bot_state_change", email: prevUser?.email,
      details: { previousState: prevUser?.botState, nextState: "pending_kyc", reason: "tenant_self_service" },
    });

    return NextResponse.json({ ok: true, kycId: kyc._id.toString() }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "server_error";
    console.error("[tenant/kyc POST]", msg);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
