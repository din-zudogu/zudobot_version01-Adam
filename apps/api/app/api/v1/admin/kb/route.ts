/**
 * GET  /api/v1/admin/kb  — list knowledge base articles
 * POST /api/v1/admin/kb  — create new article
 * Auth: x-secret-key only (admin)
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, corsHeaders } from "@/lib/middleware/apiKeyAuth";
import dbConnect from "@/lib/db/connect";
import KnowledgeBaseModel from "@/models/knowledgeBase";

function requireSecret(auth: Awaited<ReturnType<typeof authenticateRequest>>) {
  if (!auth.ok) return false;
  return auth.keyType === "secret";
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

export async function GET(req: NextRequest) {
  const cors = corsHeaders(req);
  const auth = await authenticateRequest(req);
  if (!auth.ok || !requireSecret(auth)) {
    return NextResponse.json({ error: "Admin secret key required." }, { status: 403, headers: cors });
  }

  await dbConnect();
  const { searchParams } = new URL(req.url);
  const includeInactive = searchParams.get("includeInactive") === "true";
  const filter = includeInactive
    ? { tenantId: auth.tenant._id }
    : { tenantId: auth.tenant._id, isActive: true };

  const articles = await KnowledgeBaseModel
    .find(filter)
    .select("-embedding")
    .sort({ updatedAt: -1 })
    .lean();

  return NextResponse.json({ ok: true, data: articles, total: articles.length }, { headers: cors });
}

export async function POST(req: NextRequest) {
  const cors = corsHeaders(req);
  const auth = await authenticateRequest(req);
  if (!auth.ok || !requireSecret(auth)) {
    return NextResponse.json({ error: "Admin secret key required." }, { status: 403, headers: cors });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: cors });
  }

  const b = body as Record<string, unknown>;
  const title   = String(b.title   ?? "").trim();
  const content = String(b.content ?? "").trim();
  const type    = ["text", "url", "pdf"].includes(String(b.type)) ? String(b.type) : "text";

  if (!title || !content) {
    return NextResponse.json({ error: "title and content are required." }, { status: 400, headers: cors });
  }
  if (title.length > 200 || content.length > 20000) {
    return NextResponse.json({ error: "title max 200, content max 20000 chars." }, { status: 400, headers: cors });
  }

  await dbConnect();
  const article = await KnowledgeBaseModel.create({
    tenantId:  auth.tenant._id,
    title,
    content,
    type,
    sourceUrl: b.sourceUrl ? String(b.sourceUrl) : null,
    isActive:  b.isActive !== false,
  });

  return NextResponse.json({ ok: true, data: article }, { status: 201, headers: cors });
}
