/**
 * GET  /api/v1/admin/visitors         — list visitor profiles with CRM tags
 * GET  /api/v1/admin/visitors?tag=X   — filter by tag
 * PATCH /api/v1/admin/visitors        — update notes or add/remove tags for a visitor
 * Auth: x-secret-key only.
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, corsHeaders } from "@/lib/middleware/apiKeyAuth";
import dbConnect from "@/lib/db/connect";
import VisitorProfileModel, { VisitorTag } from "@/models/visitorProfile";

const VALID_TAGS: VisitorTag[] = [
  "prospect", "hot_lead", "price_shopper", "comparison",
  "budget_sensitive", "repeat_visitor", "handoff_requested", "vip",
];

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

export async function GET(req: NextRequest) {
  const cors = corsHeaders(req);
  const auth = await authenticateRequest(req);
  if (!auth.ok || auth.keyType !== "secret") {
    return NextResponse.json({ error: "Admin secret key required." }, { status: 403, headers: cors });
  }

  const { searchParams } = new URL(req.url);
  const page    = Math.max(1, parseInt(searchParams.get("page")  || "1", 10));
  const limit   = Math.min(100, parseInt(searchParams.get("limit") || "20", 10));
  const tag     = searchParams.get("tag") || "";
  const skip    = (page - 1) * limit;

  const tenantId = String(auth.tenant._id);
  const filter: Record<string, unknown> = { tenantId };
  if (tag && VALID_TAGS.includes(tag as VisitorTag)) filter.tags = tag;

  await dbConnect();

  const [visitors, total] = await Promise.all([
    VisitorProfileModel.find(filter)
      .sort({ lastSeenAt: -1 })
      .skip(skip)
      .limit(limit)
      .select("-__v")
      .lean(),
    VisitorProfileModel.countDocuments(filter),
  ]);

  return NextResponse.json({
    ok: true,
    visitors,
    total,
    page,
    pages: Math.ceil(total / limit),
  }, { headers: cors });
}

export async function PATCH(req: NextRequest) {
  const cors = corsHeaders(req);
  const auth = await authenticateRequest(req);
  if (!auth.ok || auth.keyType !== "secret") {
    return NextResponse.json({ error: "Admin secret key required." }, { status: 403, headers: cors });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: cors });
  }

  const b         = body as Record<string, unknown>;
  const visitorId = typeof b.visitorId === "string" ? b.visitorId.trim() : null;
  if (!visitorId) return NextResponse.json({ error: "visitorId required" }, { status: 400, headers: cors });

  const tenantId = String(auth.tenant._id);
  const update: Record<string, unknown> = {};

  if (typeof b.notes === "string") {
    update.notes = b.notes.slice(0, 1000);
  }
  if (Array.isArray(b.addTags)) {
    const valid = (b.addTags as string[]).filter((t) => VALID_TAGS.includes(t as VisitorTag));
    if (valid.length > 0) update["$addToSet"] = { tags: { $each: valid } };
  }
  if (Array.isArray(b.removeTags)) {
    const valid = (b.removeTags as string[]).filter((t) => VALID_TAGS.includes(t as VisitorTag));
    if (valid.length > 0) update["$pull"] = { tags: { $in: valid } };
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No valid fields to update." }, { status: 400, headers: cors });
  }

  await dbConnect();

  // Separate $set fields from array operators
  const setFields: Record<string, unknown> = {};
  const arrayOps: Record<string, unknown>  = {};
  for (const [k, v] of Object.entries(update)) {
    if (k.startsWith("$")) arrayOps[k] = v;
    else setFields[k] = v;
  }

  const op: Record<string, unknown> = {};
  if (Object.keys(setFields).length > 0) op.$set = setFields;
  Object.assign(op, arrayOps);

  const updated = await VisitorProfileModel.findOneAndUpdate(
    { tenantId, visitorId },
    op,
    { new: true }
  ).lean();

  if (!updated) return NextResponse.json({ error: "Visitor not found." }, { status: 404, headers: cors });

  return NextResponse.json({ ok: true, visitor: updated }, { headers: cors });
}
