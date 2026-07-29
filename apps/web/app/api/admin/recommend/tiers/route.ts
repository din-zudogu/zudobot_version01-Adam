import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { ensureReferralMasterData } from "@/lib/db/pg/ensureReferralMasterData";
import { getAllTiers, createTier, updateTier } from "@/lib/db/referral";

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
    const tiers = await getAllTiers();
    return NextResponse.json({ tiers });
  } catch (err) {
    console.error("[admin/recommend/tiers GET] failed:", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

interface TierBody {
  minPoints?: number;
  maxPoints?: number | null;
  costPoints?: number;
  bonusMsgPerMonth?: number;
  bonusRetentionDays?: number;
  bonusMemoryMb?: number;
  label?: string;
  sortOrder?: number;
}

export async function POST(req: NextRequest) {
  const token = await getServerToken(req);
  if (!isAdmin(token?.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  let body: TierBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  if (typeof body.minPoints !== "number" || typeof body.costPoints !== "number" || !body.label?.trim()) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  try {
    await ensureReferralMasterData();
    const tier = await createTier({
      minPoints: body.minPoints,
      maxPoints: body.maxPoints ?? null,
      costPoints: body.costPoints,
      bonusMsgPerMonth: body.bonusMsgPerMonth ?? 0,
      bonusRetentionDays: body.bonusRetentionDays ?? 0,
      bonusMemoryMb: body.bonusMemoryMb ?? 0,
      label: body.label.trim(),
      sortOrder: body.sortOrder ?? 0,
    });
    return NextResponse.json({ tier });
  } catch (err) {
    console.error("[admin/recommend/tiers POST] failed:", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const token = await getServerToken(req);
  if (!isAdmin(token?.role)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  let body: TierBody & { id?: string; isActive?: boolean };
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
    const tier = await updateTier(body.id, {
      minPoints: body.minPoints,
      maxPoints: body.maxPoints,
      costPoints: body.costPoints,
      bonusMsgPerMonth: body.bonusMsgPerMonth,
      bonusRetentionDays: body.bonusRetentionDays,
      bonusMemoryMb: body.bonusMemoryMb,
      label: body.label,
      sortOrder: body.sortOrder,
      isActive: body.isActive,
    });
    if (!tier) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ tier });
  } catch (err) {
    console.error("[admin/recommend/tiers PATCH] failed:", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
