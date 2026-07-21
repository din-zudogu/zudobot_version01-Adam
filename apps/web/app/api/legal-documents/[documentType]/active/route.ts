/**
 * GET /api/legal-documents/:documentType/active
 * Returns the current ACTIVE legal document of a type (PDPA / Terms). Public —
 * used by the dashboard "เอกสาร" pages and the order-flow consent modal (widget).
 * CORS-open so the embedded widget can fetch it.
 */
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { LegalDocumentModel, type LegalDocumentType } from "@/lib/db/models/LegalDocument";
import { ensureDefaultPdpaDocument } from "@/lib/legal/ensureDefaultLegalDocuments";

const DOCUMENT_TYPES: LegalDocumentType[] = ["DATA_PROCESSING_AGREEMENT", "TENANT_TERMS_OF_SERVICE"];

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Without this, Next.js can statically cache this GET handler's response at
// build time (no cookies/headers/searchParams are read, so it looks "static"
// to Next's heuristic) — baking in a stale "no_active_document" 404 forever,
// even after a document is seeded into Mongo afterward.
export const dynamic = "force-dynamic";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

type RouteContext = { params: Promise<{ documentType: string }> };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  const { documentType } = await params;
  const type = String(documentType || "").trim() as LegalDocumentType;

  if (!DOCUMENT_TYPES.includes(type)) {
    return NextResponse.json({ success: false, message: "invalid_document_type", allowed: DOCUMENT_TYPES }, { status: 400, headers: CORS });
  }

  try {
    await connectDB();
    let doc = await LegalDocumentModel.findOne({ documentType: type, status: "ACTIVE" })
      .select("documentType title version content effectiveAt updatedAt")
      .lean();

    if (!doc && type === "DATA_PROCESSING_AGREEMENT") {
      await ensureDefaultPdpaDocument();
      doc = await LegalDocumentModel.findOne({ documentType: type, status: "ACTIVE" })
        .select("documentType title version content effectiveAt updatedAt")
        .lean();
    }

    if (!doc) {
      return NextResponse.json({ success: false, message: "no_active_document" }, { status: 404, headers: CORS });
    }
    return NextResponse.json({ success: true, data: doc }, { status: 200, headers: CORS });
  } catch {
    return NextResponse.json({ success: false, message: "server_error" }, { status: 500, headers: CORS });
  }
}
