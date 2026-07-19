import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { TenantProfileModel } from "@/lib/db/models/TenantProfile";
import { ConversationSessionModel } from "@/lib/db/models/ConversationSession";
import { ConsentRecordModel } from "@/lib/db/models/ConsentRecord";
import type { LegalDocumentType } from "@/lib/db/models/LegalDocument";

const DOC_TYPES = ["DATA_PROCESSING_AGREEMENT", "TENANT_TERMS_OF_SERVICE"];

function json(data: unknown, status: number) {
  return NextResponse.json(data, { status });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin":  "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export async function POST(req: NextRequest) {
  let body: { key?: string; sessionId?: string; given?: boolean; documentType?: string; version?: string };
  try { body = await req.json(); }
  catch { return json({ ok: false }, 400); }

  const { key: embedKey, sessionId, given, documentType, version } = body;
  if (!embedKey || !sessionId || given === undefined) {
    return json({ ok: false, error: "missing_fields" }, 400);
  }

  try {
    await connectDB();
    const profile = await TenantProfileModel.findOne({ embedKey }).select("tenantId").lean();
    if (!profile) return json({ ok: false, error: "invalid_key" }, 403);

    const tenantId = profile.tenantId;
    const now = new Date();

    await ConversationSessionModel.updateOne(
      { tenantId, sessionId },
      { $set: { consentGiven: !!given, consentAt: now } },
    );

    // Per-document audit (PDPA/GDPR evidence) when a documentType is supplied.
    if (documentType && DOC_TYPES.includes(documentType)) {
      await ConsentRecordModel.create({
        tenantId,
        sessionId,
        documentType: documentType as LegalDocumentType,
        version:   typeof version === "string" ? version : "",
        accepted:  !!given,
        ip:        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined,
        userAgent: req.headers.get("user-agent") || undefined,
      });
    }

    return json({ ok: true }, 200);
  } catch {
    return json({ ok: false, error: "server_error" }, 500);
  }
}
