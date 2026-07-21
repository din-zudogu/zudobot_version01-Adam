/**
 * GET /api/admin/system-log
 *
 * Query params:
 *   email    — filter by account email (optional)
 *   category — "auth" | "bot_state" | "admin_action" | "payment" (optional)
 *   from, to — ISO date strings, inclusive range (optional)
 *   page, limit — pagination (default 1 / 50, max limit 200)
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { connectDB } from "@/lib/db/connect";
import { SystemLogModel, type SystemLogCategory } from "@/lib/db/models/SystemLog";

function requireAdmin(role?: string) {
  return role === "admin" || role === "super_admin";
}

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = await getServerToken(req);
  if (!requireAdmin(token?.role as string)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const email    = searchParams.get("email")?.trim().toLowerCase() || undefined;
  const category = (searchParams.get("category") as SystemLogCategory | null) ?? undefined;
  const from     = searchParams.get("from") ?? undefined;
  const to       = searchParams.get("to")   ?? undefined;
  const page     = Math.max(1, parseInt(searchParams.get("page")  ?? "1", 10));
  const limit    = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10)));

  await connectDB();

  const filter: Record<string, unknown> = {};
  if (email)    filter.email    = email;
  if (category) filter.category = category;
  if (from || to) {
    const range: Record<string, Date> = {};
    if (from) range.$gte = new Date(from);
    if (to)   range.$lte = new Date(to);
    filter.createdAt = range;
  }

  const [statsAgg, total, logs] = await Promise.all([
    SystemLogModel.aggregate([
      { $match: filter },
      { $group: { _id: "$category", count: { $sum: 1 } } },
    ]),
    SystemLogModel.countDocuments(filter),
    SystemLogModel
      .find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
  ]);

  const byCategory: Record<string, number> = { auth: 0, bot_state: 0, admin_action: 0, payment: 0 };
  for (const row of statsAgg) {
    if (typeof row._id === "string") byCategory[row._id] = row.count;
  }

  return NextResponse.json({ stats: { byCategory, total }, total, page, limit, logs });
}
