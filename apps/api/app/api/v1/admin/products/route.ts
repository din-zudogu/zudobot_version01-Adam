/**
 * /api/v1/admin/products
 * Tenant product catalog CRUD. Auto-embeds on create/update (background).
 * Auth: x-secret-key
 *
 * GET    ?page=1&limit=20&q=keyword — paginated list
 * POST   — create product
 * PATCH  ?id= — update product
 * DELETE ?id= — delete product
 */

import { NextRequest } from "next/server";
import { authenticateRequest, corsHeaders } from "@/lib/middleware/apiKeyAuth";
import dbConnect from "@/lib/db/connect";
import ProductModel from "@/models/product";
import { embedProduct } from "@/services/svc_productEmbedding";

function err(msg: string, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify({ success: false, error: msg }), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}

function pickFields(b: Record<string, unknown>) {
  const allowed = [
    "name", "price", "priceSuffix", "shortDescription",
    "slug", "stock", "variants", "isActive",
  ] as const;
  const out: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in b) out[key] = b[key];
  }
  return out;
}

export async function OPTIONS(req: NextRequest) {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}

/* ── GET ──────────────────────────────────────────────────────────────────── */
export async function GET(req: NextRequest) {
  const cors = corsHeaders(req);
  const auth = await authenticateRequest(req);
  if (!auth.ok) return err(auth.error, auth.status, cors);

  const url   = new URL(req.url);
  const page  = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const limit = Math.min(100, parseInt(url.searchParams.get("limit") || "20", 10));
  const q     = url.searchParams.get("q")?.trim() || "";
  const skip  = (page - 1) * limit;

  await dbConnect();
  const tenantId = String(auth.tenant._id);

  const filter: Record<string, unknown> = { tenantId };
  if (q) filter.$or = [
    { name:             { $regex: q, $options: "i" } },
    { shortDescription: { $regex: q, $options: "i" } },
  ];

  const [products, total] = await Promise.all([
    ProductModel.find(filter)
      .select("-embedding")   // never send 768-dim array to dashboard
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    ProductModel.countDocuments(filter),
  ]);

  return new Response(
    JSON.stringify({ success: true, data: products, total, page, pages: Math.ceil(total / limit) }),
    { headers: { "Content-Type": "application/json", ...cors } }
  );
}

/* ── POST ─────────────────────────────────────────────────────────────────── */
export async function POST(req: NextRequest) {
  const cors = corsHeaders(req);
  const auth = await authenticateRequest(req);
  if (!auth.ok) return err(auth.error, auth.status, cors);

  let body: unknown;
  try { body = await req.json(); } catch { return err("Invalid JSON", 400, cors); }

  const b = body as Record<string, unknown>;
  if (!b.name || !String(b.name).trim()) return err("name is required", 400, cors);

  await dbConnect();
  const tenantId = String(auth.tenant._id);
  const fields   = pickFields(b);
  const product  = await ProductModel.create({ tenantId, ...fields });

  // Auto-embed in background — don't await
  embedProduct(String(product._id)).catch(() => {});

  return new Response(
    JSON.stringify({ success: true, data: product }),
    { status: 201, headers: { "Content-Type": "application/json", ...cors } }
  );
}

/* ── PATCH ────────────────────────────────────────────────────────────────── */
export async function PATCH(req: NextRequest) {
  const cors = corsHeaders(req);
  const auth = await authenticateRequest(req);
  if (!auth.ok) return err(auth.error, auth.status, cors);

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return err("id query param required", 400, cors);

  let body: unknown;
  try { body = await req.json(); } catch { return err("Invalid JSON", 400, cors); }

  const b = body as Record<string, unknown>;
  await dbConnect();

  const tenantId = String(auth.tenant._id);
  const product  = await ProductModel.findOne({ _id: id, tenantId });
  if (!product) return err("Not found", 404, cors);

  const fields = pickFields(b);
  const contentChanged = (
    "name" in fields || "shortDescription" in fields ||
    "price" in fields || "variants" in fields
  );

  Object.assign(product, fields);

  // Clear old embedding if content changed — will re-embed below
  if (contentChanged) {
    product.embedding  = [];
    product.embeddedAt = null;
  }
  await product.save();

  // Re-embed in background if content changed
  if (contentChanged) embedProduct(id).catch(() => {});

  return new Response(
    JSON.stringify({ success: true, data: product }),
    { headers: { "Content-Type": "application/json", ...cors } }
  );
}

/* ── DELETE ───────────────────────────────────────────────────────────────── */
export async function DELETE(req: NextRequest) {
  const cors = corsHeaders(req);
  const auth = await authenticateRequest(req);
  if (!auth.ok) return err(auth.error, auth.status, cors);

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return err("id query param required", 400, cors);

  await dbConnect();
  const tenantId = String(auth.tenant._id);
  const result   = await ProductModel.deleteOne({ _id: id, tenantId });
  if (result.deletedCount === 0) return err("Not found", 404, cors);

  return new Response(
    JSON.stringify({ success: true }),
    { headers: { "Content-Type": "application/json", ...cors } }
  );
}
