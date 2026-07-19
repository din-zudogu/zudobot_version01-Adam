/**
 * GET /api/v1/rules-log
 * Returns rule violation log for a tenant (dashboard use).
 * Auth: x-secret-key required.
 */

import { NextRequest } from "next/server";
import { authenticateRequest, corsHeaders } from "@/lib/middleware/apiKeyAuth";
import dbConnect from "@/lib/db/connect";
import RuleViolationModel from "@/models/ruleViolation";

function err(msg: string, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify({ success: false, message: msg }), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}

export async function OPTIONS(req: NextRequest) {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}

export async function GET(req: NextRequest) {
  const cors = corsHeaders(req);
  const auth = await authenticateRequest(req);
  if (!auth.ok) return err(auth.error, auth.status, cors);

  const { searchParams } = new URL(req.url);
  const page  = Math.max(1, parseInt(searchParams.get("page")  || "1", 10));
  const limit = Math.min(100, parseInt(searchParams.get("limit") || "20", 10));
  const skip  = (page - 1) * limit;

  await dbConnect();

  const tenantId = String(auth.tenant._id);
  const [violations, total] = await Promise.all([
    RuleViolationModel.find({ tenantId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    RuleViolationModel.countDocuments({ tenantId }),
  ]);

  return new Response(
    JSON.stringify({ success: true, violations, total, page, pages: Math.ceil(total / limit) }),
    { status: 200, headers: { "Content-Type": "application/json", ...cors } }
  );
}
