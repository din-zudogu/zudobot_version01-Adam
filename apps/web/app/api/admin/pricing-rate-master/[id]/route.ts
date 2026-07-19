import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { connectDB } from "@/lib/db/connect";
import { PricingRateMasterModel } from "@/lib/db/models/PricingRateMaster";
import { invalidatePricingRateCache } from "@/lib/pricing/getActivePricingRates";

type RouteContext = { params: Promise<{ id: string }> };

function requireAdmin(role?: string) {
  return role === "admin" || role === "super_admin";
}
function requireSuperAdmin(role?: string) {
  return role === "super_admin";
}

// ── GET — single record ───────────────────────────────────────────────────────

export async function GET(req: NextRequest, { params }: RouteContext) {
  const token = await getServerToken(req);
  if (!requireAdmin(token?.role as string)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;
  try {
    await connectDB();
    const master = await PricingRateMasterModel.findById(id).lean();
    if (!master) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ master });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

// ── PUT — update record ───────────────────────────────────────────────────────

export async function PUT(req: NextRequest, { params }: RouteContext) {
  const token = await getServerToken(req);
  if (!requireSuperAdmin(token?.role as string)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  try {
    await connectDB();

    // Disallow changing isDefault via PUT — use the dedicated set-default endpoint
    delete body.isDefault;

    const master = await PricingRateMasterModel.findByIdAndUpdate(
      id,
      { $set: body },
      { new: true },
    ).lean();

    if (!master) return NextResponse.json({ error: "not_found" }, { status: 404 });
    invalidatePricingRateCache();
    return NextResponse.json({ master });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "server_error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

// ── DELETE — remove record ────────────────────────────────────────────────────

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const token = await getServerToken(req);
  if (!requireSuperAdmin(token?.role as string)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { id } = await params;
  try {
    await connectDB();
    const master = await PricingRateMasterModel.findById(id).select("isDefault").lean() as
      { isDefault: boolean } | null;

    if (!master) return NextResponse.json({ error: "not_found" }, { status: 404 });
    if (master.isDefault) {
      return NextResponse.json(
        { error: "cannot_delete_default_rate_master" },
        { status: 409 },
      );
    }

    await PricingRateMasterModel.findByIdAndDelete(id);
    invalidatePricingRateCache();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
