/**
 * GET    /api/partner/client-data/[id]?unmask=1  — detail (optional unmask)
 * PUT    /api/partner/client-data/[id]            — update
 * DELETE /api/partner/client-data/[id]            — delete
 */
import { NextRequest, NextResponse } from "next/server";
import { getPartnerToken } from "@/lib/auth/getPartnerToken";
import { connectDB } from "@/lib/db/connect";
import { PartnerProfileModel } from "@/lib/db/models/PartnerProfile";
import { PartnerClientDataModel } from "@/lib/db/models/PartnerClientData";
import {
  encryptPII, decryptPII,
  maskNationalId, maskTaxId, maskPhone, maskEmail,
} from "@/lib/utils/piiEncrypt";

async function getPartnerId(token: NonNullable<Awaited<ReturnType<typeof getPartnerToken>>>): Promise<string | null> {
  const partner = await PartnerProfileModel.findOne({ userId: token.sub }).select("_id").lean();
  return partner ? partner._id.toString() : null;
}

function safeDecrypt(enc: string | undefined | null): string {
  if (!enc) return "";
  try { return decryptPII(enc); } catch { return ""; }
}

function maskClientDoc(doc: InstanceType<typeof PartnerClientDataModel>, unmask = false) {
  const natDec   = safeDecrypt(doc.nationalIdEnc);
  const passDec  = safeDecrypt(doc.passportEnc);
  const taxDec   = safeDecrypt(doc.taxIdEnc);
  const phoneDec = safeDecrypt(doc.phoneEnc);
  const emailDec = safeDecrypt(doc.emailEnc);

  return {
    _id:           doc._id.toString(),
    partnerId:     doc.partnerId,
    tenantId:      doc.tenantId,
    entityType:    doc.entityType,
    fullName:      doc.fullName      ?? "",
    nationalId:    unmask ? natDec   : maskNationalId(natDec),
    passport:      unmask ? passDec  : (passDec ? "XX-XXXXXXX" : ""),
    addressBilling:doc.addressBilling ?? "",
    phone:         unmask ? phoneDec : maskPhone(phoneDec),
    email:         unmask ? emailDec : maskEmail(emailDec),
    corporateName: doc.corporateName  ?? "",
    taxId:         unmask ? taxDec   : maskTaxId(taxDec),
    addressOffice: doc.addressOffice  ?? "",
    branchCode:    doc.branchCode     ?? "",
    contactPerson: doc.contactPerson  ?? "",
    createdAt:     doc.createdAt,
    updatedAt:     doc.updatedAt,
  };
}

async function getOwnedDoc(id: string, partnerId: string) {
  return PartnerClientDataModel.findOne({ _id: id, partnerId });
}

// ── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = await getPartnerToken(req);
  if (!token) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const unmask = new URL(req.url).searchParams.get("unmask") === "1";

  await connectDB();
  const partnerId = await getPartnerId(token);
  if (!partnerId) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const doc = await getOwnedDoc(id, partnerId);
  if (!doc) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json({ client: maskClientDoc(doc, unmask) });
}

// ── PUT ──────────────────────────────────────────────────────────────────────

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = await getPartnerToken(req);
  if (!token) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;

  let body: Record<string, string>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  await connectDB();
  const partnerId = await getPartnerId(token);
  if (!partnerId) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const doc = await getOwnedDoc(id, partnerId);
  if (!doc) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const enc   = (v: string | undefined) => (v ? encryptPII(v) : undefined);
  const encId = (v: string | undefined) => (v ? encryptPII(v.replace(/\D/g, "")) : undefined);

  const update: Record<string, unknown> = {
    entityType:     body.entityType    || doc.entityType,
    fullName:       body.fullName      || undefined,
    nationalIdEnc:  body.nationalId !== undefined ? encId(body.nationalId) : undefined,
    passportEnc:    body.passport   !== undefined ? enc(body.passport)     : undefined,
    addressBilling: body.addressBilling || undefined,
    phoneEnc:       body.phone      !== undefined ? enc(body.phone)        : undefined,
    emailEnc:       body.email      !== undefined ? enc(body.email)        : undefined,
    corporateName:  body.corporateName || undefined,
    taxIdEnc:       body.taxId      !== undefined ? encId(body.taxId)      : undefined,
    addressOffice:  body.addressOffice || undefined,
    branchCode:     body.branchCode    || undefined,
    contactPerson:  body.contactPerson || undefined,
  };

  for (const k of Object.keys(update)) { if (update[k] === undefined) delete update[k]; }

  await doc.set(update).save();
  return NextResponse.json({ ok: true });
}

// ── DELETE ───────────────────────────────────────────────────────────────────

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const token = await getPartnerToken(req);
  if (!token) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;

  await connectDB();
  const partnerId = await getPartnerId(token);
  if (!partnerId) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const doc = await getOwnedDoc(id, partnerId);
  if (!doc) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await doc.deleteOne();
  return NextResponse.json({ ok: true });
}
