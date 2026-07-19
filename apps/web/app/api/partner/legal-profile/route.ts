/**
 * GET  /api/partner/legal-profile  — load profile (returns masked PII)
 * PUT  /api/partner/legal-profile  — save/update (encrypts PII before storing)
 */
import { NextRequest, NextResponse } from "next/server";
import { getPartnerToken } from "@/lib/auth/getPartnerToken";
import { connectDB } from "@/lib/db/connect";
import { PartnerProfileModel } from "@/lib/db/models/PartnerProfile";
import { PartnerLegalProfileModel } from "@/lib/db/models/PartnerLegalProfile";
import { encryptPII, decryptPII, maskNationalId, maskTaxId, maskBankAccount } from "@/lib/utils/piiEncrypt";

export async function GET(req: NextRequest) {
  const token = await getPartnerToken(req);
  if (!token) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const unmask = new URL(req.url).searchParams.get("unmask") === "1";

  await connectDB();
  const partner = await PartnerProfileModel.findOne({ userId: token.sub }).lean();
  if (!partner) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const legal = await PartnerLegalProfileModel.findOne({ partnerId: partner._id.toString() }).lean();
  if (!legal) return NextResponse.json({ profile: null });

  // Decrypt then optionally mask PII
  function safeDec(enc: string | undefined | null): string {
    if (!enc) return "";
    try { return decryptPII(enc); } catch { return ""; }
  }

  function display(dec: string, mask: (s: string) => string): string {
    if (!dec) return "";
    return unmask ? dec : mask(dec);
  }

  const nationalIdDec  = safeDec(legal.nationalIdEnc);
  const taxIdDec       = safeDec(legal.taxIdEnc);
  const bankIndDec     = safeDec(legal.bankAccIndEnc);
  const bankCorpDec    = safeDec(legal.bankAccCorpEnc);

  return NextResponse.json({
    profile: {
      entityType:          legal.entityType,
      fullNameInd:         legal.fullNameInd          ?? "",
      nationalId:          display(nationalIdDec,  maskNationalId),
      addressResidence:    legal.addressResidence   ?? "",
      bankAccInd:          display(bankIndDec,      maskBankAccount),
      corporateName:       legal.corporateName      ?? "",
      taxId:               display(taxIdDec,        maskTaxId),
      addressOffice:       legal.addressOffice      ?? "",
      branchCode:          legal.branchCode         ?? "",
      authorizedSignatory: legal.authorizedSignatory ?? "",
      bankAccCorp:         display(bankCorpDec,     maskBankAccount),
      documentUrls:        legal.documentUrls       ?? [],
      unmasked:            unmask,
    },
  });
}

export async function PUT(req: NextRequest) {
  const token = await getPartnerToken(req);
  if (!token) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: Record<string, string>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  const { entityType } = body;
  if (entityType !== "individual" && entityType !== "corporate") {
    return NextResponse.json({ error: "invalid_entity_type" }, { status: 400 });
  }

  await connectDB();
  const partner = await PartnerProfileModel.findOne({ userId: token.sub }).lean();
  if (!partner) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const partnerId = partner._id.toString();

  // Validate Thai 13-digit IDs
  const validateId = (id: string, field: string) => {
    if (!id) return null;
    const digits = id.replace(/\D/g, "");
    if (digits.length !== 13) return `${field} ต้องมี 13 หลัก`;
    return null;
  };

  if (entityType === "individual") {
    const err = validateId(body.nationalId ?? "", "เลขบัตรประชาชน");
    if (err) return NextResponse.json({ error: err }, { status: 400 });
  } else {
    const err = validateId(body.taxId ?? "", "เลขผู้เสียภาษี");
    if (err) return NextResponse.json({ error: err }, { status: 400 });
  }

  // Encrypt sensitive fields
  const safeEnc = (val: string | undefined): string | undefined => {
    if (!val) return undefined;
    return encryptPII(val.replace(/\D/g, "") || val); // strip formatting for IDs, store raw
  };

  const update: Record<string, unknown> = {
    entityType,
    fullNameInd:          body.fullNameInd         || undefined,
    nationalIdEnc:        body.nationalId           ? encryptPII(body.nationalId.replace(/\D/g, "")) : undefined,
    addressResidence:     body.addressResidence     || undefined,
    bankAccIndEnc:        safeEnc(body.bankAccInd),
    corporateName:        body.corporateName        || undefined,
    taxIdEnc:             body.taxId               ? encryptPII(body.taxId.replace(/\D/g, "")) : undefined,
    addressOffice:        body.addressOffice        || undefined,
    branchCode:           body.branchCode          || undefined,
    authorizedSignatory:  body.authorizedSignatory  || undefined,
    bankAccCorpEnc:       safeEnc(body.bankAccCorp),
  };

  // Remove undefined keys to avoid overwriting existing encrypted values with undefined
  for (const key of Object.keys(update)) {
    if (update[key] === undefined) delete update[key];
  }

  await PartnerLegalProfileModel.findOneAndUpdate(
    { partnerId },
    { $set: update },
    { upsert: true, new: true }
  );

  return NextResponse.json({ ok: true });
}
