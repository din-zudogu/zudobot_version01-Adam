/**
 * POST /api/v1/admin/products/embed
 * Batch re-embed all products for this tenant using text-embedding-004.
 * Auth: x-secret-key
 *
 * Returns: { total, done, failed }
 */

import { NextRequest } from "next/server";
import { authenticateRequest, corsHeaders } from "@/lib/middleware/apiKeyAuth";
import dbConnect from "@/lib/db/connect";
import { batchEmbedProducts } from "@/services/svc_productEmbedding";

function err(msg: string, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify({ success: false, error: msg }), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}

export async function OPTIONS(req: NextRequest) {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}

export async function POST(req: NextRequest) {
  const cors = corsHeaders(req);
  const auth = await authenticateRequest(req);
  if (!auth.ok) return err(auth.error, auth.status, cors);

  if (!process.env.GEMINI_API_KEY) {
    return err("GEMINI_API_KEY not configured — cannot embed products", 503, cors);
  }

  await dbConnect();
  const tenantId = String(auth.tenant._id);

  const result = await batchEmbedProducts(tenantId);

  return new Response(
    JSON.stringify({
      success: true,
      message: `Embedded ${result.done}/${result.total} products. Failed: ${result.failed}`,
      ...result,
    }),
    { headers: { "Content-Type": "application/json", ...cors } }
  );
}
