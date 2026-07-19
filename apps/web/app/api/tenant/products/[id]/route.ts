/**
 * PUT    /api/tenant/products/[id]  — update a product
 * DELETE /api/tenant/products/[id]  — delete a product
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { connectDB } from "@/lib/db/connect";
import { ProductModel } from "@/lib/db/models/Product";

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const token = await getServerToken(req);
  if (!token?.sub || token.role !== "tenant") return json({ error: "unauthorized" }, 401);

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return json({ error: "invalid_body" }, 400); }

  const allowed = ["name","price","priceSuffix","shortDescription","slug","stock","imageUrl","productUrl","stripePaymentLink","isActive"];
  const update: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) update[key] = body[key];
  }

  if (Object.keys(update).length === 0) return json({ error: "nothing_to_update" }, 400);

  try {
    await connectDB();
    const result = await ProductModel.findOneAndUpdate(
      { _id: params.id, tenantId: token.sub },
      { $set: update },
      { new: true }
    ).lean();
    if (!result) return json({ error: "not_found" }, 404);
    return json({ product: result });
  } catch {
    return json({ error: "server_error" }, 500);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const token = await getServerToken(req);
  if (!token?.sub || token.role !== "tenant") return json({ error: "unauthorized" }, 401);

  try {
    await connectDB();
    const result = await ProductModel.deleteOne({ _id: params.id, tenantId: token.sub });
    if (result.deletedCount === 0) return json({ error: "not_found" }, 404);
    return json({ ok: true });
  } catch {
    return json({ error: "server_error" }, 500);
  }
}
