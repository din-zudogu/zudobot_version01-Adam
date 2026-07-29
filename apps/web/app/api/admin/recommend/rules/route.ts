import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { ensureReferralMasterData } from "@/lib/db/pg/ensureReferralMasterData";
import { getAllRuleConfig, createRuleConfig, updateRuleConfig } from "@/lib/db/referral";

export const dynamic = "force-dynamic";

function isAdmin(role: unknown): boolean {
  return role === "super_admin" || role === "admin";
}

export async function GET(req: NextRequest) {
  const token = await getServerToken(req);
  if (!isAdmin(token?.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  try {
    await ensureReferralMasterData();
    const rules = await getAllRuleConfig();
    return NextResponse.json({ rules });
  } catch (err) {
    console.error("[admin/recommend/rules GET] failed:", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const token = await getServerToken(req);
  if (!isAdmin(token?.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  let body: { eventType?: string; packageId?: string | null; points?: number; label?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  if (!body.eventType || typeof body.points !== "number" || !body.label?.trim()) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  try {
    await ensureReferralMasterData();
    const rule = await createRuleConfig({
      eventType: body.eventType,
      packageId: body.packageId?.trim() || null,
      points: body.points,
      label: body.label.trim(),
    });
    return NextResponse.json({ rule });
  } catch (err) {
    console.error("[admin/recommend/rules POST] failed:", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const token = await getServerToken(req);
  if (!isAdmin(token?.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  let body: { id?: string; points?: number; label?: string; isActive?: boolean; packageId?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  if (!body.id) {
    return NextResponse.json({ error: "missing_id" }, { status: 400 });
  }
  try {
    await ensureReferralMasterData();
    const rule = await updateRuleConfig(body.id, {
      points: body.points,
      label: body.label,
      isActive: body.isActive,
      packageId: body.packageId,
    });
    if (!rule) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ rule });
  } catch (err) {
    console.error("[admin/recommend/rules PATCH] failed:", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
