/**
 * GET  /api/tenant/products        — list all products for this tenant
 * POST /api/tenant/products        — create a new product
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { connectDB } from "@/lib/db/connect";
import { ProductModel } from "@/lib/db/models/Product";

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export async function GET(req: NextRequest) {
  const token = await getServerToken(req);
  if (!token?.sub || token.role !== "tenant") return json({ error: "unauthorized" }, 401);

  try {
    await connectDB();
    const products = await ProductModel.find({ tenantId: token.sub })
      .sort({ updatedAt: -1 })
      .lean();
    return json({ products });
  } catch {
    return json({ error: "server_error" }, 500);
  }
}

export async function POST(req: NextRequest) {
  const token = await getServerToken(req);
  if (!token?.sub || token.role !== "tenant") return json({ error: "unauthorized" }, 401);

  let body: {
    name?: string;
    price?: number;
    priceSuffix?: string;
    shortDescription?: string;
    slug?: string;
    stock?: number | null;
    imageUrl?: string;
    productUrl?: string;
    stripePaymentLink?: string;
    isActive?: boolean;
  };
  try { body = await req.json(); }
  catch { return json({ error: "invalid_body" }, 400); }

  if (!body.name?.trim()) return json({ error: "name_required" }, 400);

  try {
    await connectDB();
    const product = await ProductModel.create({
      tenantId:         token.sub,
      name:             body.name.trim(),
      price:            body.price ?? 0,
      priceSuffix:      body.priceSuffix?.trim() ?? "",
      shortDescription: body.shortDescription?.trim() ?? "",
      slug:             body.slug?.trim() ?? "",
      stock:            body.stock ?? null,
      imageUrl:          body.imageUrl?.trim() || undefined,
      productUrl:        body.productUrl?.trim() || undefined,
      stripePaymentLink: body.stripePaymentLink?.trim() || undefined,
      isActive:          body.isActive !== false,
    });
    return json({ product }, 201);
  } catch {
    return json({ error: "server_error" }, 500);
  }
}
