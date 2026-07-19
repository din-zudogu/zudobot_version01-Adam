/**
 * POST /api/widget/checkout
 *
 * Creates a checkout URL for a product recommended in the widget.
 * Priority:
 *   1. product.stripePaymentLink (pre-configured Stripe Payment Link)
 *   2. product.productUrl (fallback external store link)
 *
 * Body: { key: embedKey, productId: string }
 * Returns: { url: string } — open in new tab on the client
 */
import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { TenantProfileModel } from "@/lib/db/models/TenantProfile";
import { ProductModel } from "@/lib/db/models/Product";

function corsHeaders(origin: string) {
  return {
    "Access-Control-Allow-Origin":  origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age":       "86400",
  };
}

function json(data: unknown, status: number, origin: string) {
  return NextResponse.json(data, { status, headers: corsHeaders(origin) });
}

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get("origin") ?? "*";
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}

function safeUrl(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    return parsed.href;
  } catch { return null; }
}

export async function POST(req: NextRequest) {
  const rawOrigin = req.headers.get("origin") || req.headers.get("referer") || "";

  let body: { key?: string; productId?: string };
  try { body = await req.json(); }
  catch { return json({ ok: false, error: "invalid_body" }, 400, rawOrigin); }

  const { key: embedKey, productId } = body;
  if (!embedKey || !productId) {
    return json({ ok: false, error: "missing_fields" }, 400, rawOrigin);
  }

  try {
    await connectDB();

    const profile = await TenantProfileModel.findOne({ embedKey }).lean();
    if (!profile || !profile.widgetEnabled) {
      return json({ ok: false, error: "invalid_key" }, 403, rawOrigin);
    }

    const product = await ProductModel.findOne({
      _id:      productId,
      tenantId: profile.tenantId,
      isActive: true,
    }).lean();

    if (!product) {
      return json({ ok: false, error: "product_not_found" }, 404, rawOrigin);
    }

    // Priority 1: Stripe Payment Link (pre-configured by tenant)
    const stripeUrl = safeUrl(product.stripePaymentLink);
    if (stripeUrl) {
      return json({ ok: true, url: stripeUrl }, 200, rawOrigin);
    }

    // Priority 2: product URL (external store page)
    const productUrl = safeUrl(product.productUrl);
    if (productUrl) {
      return json({ ok: true, url: productUrl }, 200, rawOrigin);
    }

    return json({ ok: false, error: "no_checkout_url" }, 404, rawOrigin);
  } catch {
    return json({ ok: false, error: "server_error" }, 500, rawOrigin);
  }
}
