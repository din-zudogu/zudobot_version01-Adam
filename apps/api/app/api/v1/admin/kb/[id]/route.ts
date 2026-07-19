/**
 * GET    /api/v1/admin/kb/[id]  — fetch one article
 * PATCH  /api/v1/admin/kb/[id]  — update article
 * DELETE /api/v1/admin/kb/[id]  — delete article
 * Auth: x-secret-key only (admin)
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, corsHeaders } from "@/lib/middleware/apiKeyAuth";
import dbConnect from "@/lib/db/connect";
import KnowledgeBaseModel from "@/models/knowledgeBase";
import mongoose from "mongoose";

function requireSecret(auth: Awaited<ReturnType<typeof authenticateRequest>>) {
  if (!auth.ok) return false;
  return auth.keyType === "secret";
}

type RouteContext = { params: { id: string } };

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  const cors = corsHeaders(req);
  const auth = await authenticateRequest(req);
  if (!auth.ok || !requireSecret(auth)) {
    return NextResponse.json({ error: "Admin secret key required." }, { status: 403, headers: cors });
  }
  if (!mongoose.isValidObjectId(params.id)) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400, headers: cors });
  }

  await dbConnect();
  const article = await KnowledgeBaseModel
    .findOne({ _id: params.id, tenantId: auth.tenant._id })
    .select("-embedding")
    .lean();

  if (!article) {
    return NextResponse.json({ error: "Not found." }, { status: 404, headers: cors });
  }
  return NextResponse.json({ ok: true, data: article }, { headers: cors });
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const cors = corsHeaders(req);
  const auth = await authenticateRequest(req);
  if (!auth.ok || !requireSecret(auth)) {
    return NextResponse.json({ error: "Admin secret key required." }, { status: 403, headers: cors });
  }
  if (!mongoose.isValidObjectId(params.id)) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400, headers: cors });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: cors });
  }

  const b = body as Record<string, unknown>;
  const allowed = ["title", "content", "type", "sourceUrl", "isActive"];
  const update: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in b) update[key] = b[key];
  }

  if (update.title    && String(update.title).length    > 200)   delete update.title;
  if (update.content  && String(update.content).length  > 20000) delete update.content;
  if (update.type     && !["text","url","pdf"].includes(String(update.type))) delete update.type;

  await dbConnect();
  const updated = await KnowledgeBaseModel.findOneAndUpdate(
    { _id: params.id, tenantId: auth.tenant._id },
    { $set: update },
    { new: true, runValidators: true }
  ).select("-embedding").lean();

  if (!updated) {
    return NextResponse.json({ error: "Not found." }, { status: 404, headers: cors });
  }
  return NextResponse.json({ ok: true, data: updated }, { headers: cors });
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const cors = corsHeaders(req);
  const auth = await authenticateRequest(req);
  if (!auth.ok || !requireSecret(auth)) {
    return NextResponse.json({ error: "Admin secret key required." }, { status: 403, headers: cors });
  }
  if (!mongoose.isValidObjectId(params.id)) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400, headers: cors });
  }

  await dbConnect();
  const deleted = await KnowledgeBaseModel.findOneAndDelete({
    _id: params.id,
    tenantId: auth.tenant._id,
  });

  if (!deleted) {
    return NextResponse.json({ error: "Not found." }, { status: 404, headers: cors });
  }
  return NextResponse.json({ ok: true, message: "Deleted." }, { headers: cors });
}
