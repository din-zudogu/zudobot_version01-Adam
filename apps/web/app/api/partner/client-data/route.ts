/**
 * GET  /api/partner/client-data?page&limit  — list partner's clients (masked)
 * POST /api/partner/client-data             — create client record (encrypt PII)
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

function maskClient(doc: InstanceType<typeof PartnerClientDataModel>, unmask = false) {
  const nationalIdDec = safeDecrypt(doc.nationalIdEnc);
  const passportDec   = safeDecrypt(doc.passportEnc);
  const taxIdDec      = safeDecrypt(doc.taxIdEnc);
  const phoneDec      = safeDecrypt(doc.phoneEnc);
  const emailDec      = safeDecrypt(doc.emailEnc);

  return {
    _id:           doc._id.toString(),
    partnerId:     doc.partnerId,
    tenantId:      doc.tenantId,
    entityType:    doc.entityType,
    fullName:      doc.fullName      ?? "",
    nationalId:    unmask ? nationalIdDec : maskNationalId(nationalIdDec),
    passport:      unmask ? passportDec   : (passportDec ? "XX-XXXXXXX" : ""),
    addressBilling:doc.addressBilling ?? "",
    phone:         unmask ? phoneDec      : maskPhone(phoneDec),
    email:         unmask ? emailDec      : maskEmail(emailDec),
    corporateName: doc.corporateName  ?? "",
    taxId:         unmask ? taxIdDec      : maskTaxId(taxIdDec),
    addressOffice: doc.addressOffice  ?? "",
    branchCode:    doc.branchCode     ?? "",
    contactPerson: doc.contactPerson  ?? "",
    createdAt:     doc.createdAt,
    updatedAt:     doc.updatedAt,
  };
}

// ── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const token = await getPartnerToken(req);
  if (!token) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const page   = Math.max(1, parseInt(searchParams.get("page")  ?? "1",  10));
  const limit  = Math.min(50, parseInt(searchParams.get("limit") ?? "20", 10));

  await connectDB();
  const partnerId = await getPartnerId(token);
  if (!partnerId) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const [docs, total] = await Promise.all([
    PartnerClientDataModel.find({ partnerId }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    PartnerClientDataModel.countDocuments({ partnerId }),
  ]);

  const clients = docs.map((d) => maskClient(d));
  return NextResponse.json({ clients, total, page, limit });
}

// ── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const token = await getPartnerToken(req);
  if (!token) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: Record<string, string>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  const { entityType } = body;
  if (entityType !== "individual" && entityType !== "corporate") {
    return NextResponse.json({ error: "invalid_entity_type" }, { status: 400 });
  }

  await connectDB();
  const partnerId = await getPartnerId(token);
  if (!partnerId) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Validation
  const validateId13 = (val: string, field: string) => {
    if (!val) return `${field} ต้องกรอก`;
    if (val.replace(/\D/g, "").length !== 13) return `${field} ต้องมี 13 หลัก`;
    return null;
  };
  if (entityType === "individual") {
    const e = validateId13(body.nationalId ?? "", "เลขบัตรประชาชน");
    if (e) return NextResponse.json({ error: e }, { status: 400 });
  } else {
    const e = validateId13(body.taxId ?? "", "เลขผู้เสียภาษี");
    if (e) return NextResponse.json({ error: e }, { status: 400 });
  }

  const enc = (v: string | undefined) => (v ? encryptPII(v) : undefined);
  const encId = (v: string | undefined) => (v ? encryptPII(v.replace(/\D/g, "")) : undefined);

  const doc = await PartnerClientDataModel.create({
    partnerId,
    tenantId:       body.tenantId      || undefined,
    entityType,
    fullName:       body.fullName      || undefined,
    nationalIdEnc:  encId(body.nationalId),
    passportEnc:    enc(body.passport),
    addressBilling: body.addressBilling || undefined,
    phoneEnc:       enc(body.phone),
    emailEnc:       enc(body.email),
    corporateName:  body.corporateName || undefined,
    taxIdEnc:       encId(body.taxId),
    addressOffice:  body.addressOffice || undefined,
    branchCode:     body.branchCode    || undefined,
    contactPerson:  body.contactPerson || undefined,
  });

  return NextResponse.json({ ok: true, _id: doc._id.toString() }, { status: 201 });
}
