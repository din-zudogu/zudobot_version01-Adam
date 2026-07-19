import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { connectDB } from "@/lib/db/connect";
import {
  PricingRateMasterModel,
  buildDefaultMasterSeedData,
} from "@/lib/db/models/PricingRateMaster";
import { invalidatePricingRateCache } from "@/lib/pricing/getActivePricingRates";
import { getDefaultRateConfig } from "@/lib/pricing/costRateConstants";

function requireAdmin(role?: string) {
  return role === "admin" || role === "super_admin";
}
function requireSuperAdmin(role?: string) {
  return role === "super_admin";
}

// ── GET — list all rate master records ───────────────────────────────────────

export async function GET(req: NextRequest) {
  const token = await getServerToken(req);
  if (!requireAdmin(token?.role as string)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    await connectDB();
    const masters = await PricingRateMasterModel.find()
      .sort({ isDefault: -1, effectiveDate: -1 })
      .lean();

    // Also return the hardcoded fallback values so the UI can show what's
    // in use when no DB record exists.
    const fallback = getDefaultRateConfig();
    return NextResponse.json({ masters, total: masters.length, fallback });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

// ── POST — create a new rate master record ────────────────────────────────────

export async function POST(req: NextRequest) {
  const token = await getServerToken(req);
  if (!requireSuperAdmin(token?.role as string)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  // Validate required fields
  if (!body.label) {
    return NextResponse.json({ error: "label_required" }, { status: 400 });
  }
  if (!body.usdToThb || !body.aiRates || !body.storageRates) {
    return NextResponse.json({ error: "rate_fields_required" }, { status: 400 });
  }

  try {
    await connectDB();

    // If this is marked as default, clear the old default first
    if (body.isDefault === true) {
      await PricingRateMasterModel.updateMany({}, { $set: { isDefault: false } });
    }

    const master = await PricingRateMasterModel.create({
      ...body,
      createdBy: token?.email ?? "unknown",
    });

    invalidatePricingRateCache();
    return NextResponse.json({ master }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "server_error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

// ── POST /seed — bootstrap DB with current costRateConstants.ts values ────────
// Mounted on same route but triggered by ?action=seed query param to keep it
// one file (no extra route segment needed for a one-off admin action).

export async function PUT(req: NextRequest) {
  const token = await getServerToken(req);
  if (!requireSuperAdmin(token?.role as string)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const action = req.nextUrl.searchParams.get("action");
  if (action !== "seed") {
    return NextResponse.json({ error: "use_PUT_seed_only" }, { status: 400 });
  }

  try {
    await connectDB();

    // Upsert: if a default already exists, don't duplicate
    const existing = await PricingRateMasterModel.findOne({ isDefault: true });
    if (existing) {
      return NextResponse.json(
        { message: "default_already_exists", master: existing },
        { status: 200 },
      );
    }

    const seedData = buildDefaultMasterSeedData(token?.email ?? "system");
    const master = await PricingRateMasterModel.create(seedData);
    invalidatePricingRateCache();
    return NextResponse.json({ master }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "server_error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
