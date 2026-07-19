/**
 * GET  /api/admin/few-shot-extract  — list current examples (paginated)
 * POST /api/admin/few-shot-extract  — trigger extraction run
 * DELETE /api/admin/few-shot-extract?id=<id>  — remove a specific example
 */
import { NextRequest, NextResponse }   from "next/server";
import { getServerToken }              from "@/lib/auth/getServerToken";
import { connectDB }                   from "@/lib/db/connect";
import { FewShotExampleModel }         from "@/lib/db/models/FewShotExample";
import { extractFewShotExamples }      from "@/lib/ai/fewShotExtractor";
import { invalidateFewShotCache }      from "@/lib/ai/fewShotLoader";
import mongoose from "mongoose";

function requireSuperAdmin(role?: string) { return role === "super_admin"; }
function requireAdmin(role?: string)      { return role === "admin" || role === "super_admin"; }

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = await getServerToken(req);
  if (!requireAdmin(token?.role as string)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { searchParams } = new URL(req.url);
  const limit  = Math.min(100, parseInt(searchParams.get("limit")  ?? "50", 10));
  const offset = Math.max(0,   parseInt(searchParams.get("offset") ?? "0",  10));

  await connectDB();
  const [total, examples] = await Promise.all([
    FewShotExampleModel.countDocuments({ isGlobal: true }),
    FewShotExampleModel
      .find({ isGlobal: true })
      .sort({ engagementScore: -1, extractedAt: -1 })
      .skip(offset)
      .limit(limit)
      .lean(),
  ]);
  return NextResponse.json({ total, examples });
}

export async function POST(req: NextRequest) {
  const token = await getServerToken(req);
  if (!requireSuperAdmin(token?.role as string)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const lookbackDays = Math.min(30, parseInt(String(body.lookbackDays ?? 30), 10));
  const maxPerRun    = Math.min(100, parseInt(String(body.maxPerRun ?? 50), 10));

  const result = await extractFewShotExamples(lookbackDays, maxPerRun);
  return NextResponse.json({ ok: true, result });
}

export async function DELETE(req: NextRequest) {
  const token = await getServerToken(req);
  if (!requireSuperAdmin(token?.role as string)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id || !mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "invalid_id" }, { status: 400 });
  }
  await connectDB();
  await FewShotExampleModel.findByIdAndDelete(id);
  invalidateFewShotCache();
  return NextResponse.json({ ok: true });
}
