/**
 * POST /api/admin/packages-purge
 *
 * One-time super_admin endpoint to permanently delete all documents from
 * the MasterPlanConfig and PackageConfig MongoDB collections.
 *
 * Security:
 *   - super_admin role required (server-side token check)
 *   - Requires explicit confirmation body: { confirm: "DELETE_ALL_PACKAGES" }
 *   - Returns counts of deleted documents for audit logging
 *
 * NOTE: The MongoDB models (MasterPlanConfigModel, PackageConfigModel) are
 * intentionally NOT deleted here because other live features (partner billing,
 * tenant management, cron jobs, Stripe checkout) still import them. Those
 * features will be rewritten separately. This endpoint only clears the data.
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { connectDB } from "@/lib/db/connect";
import { MasterPlanConfigModel } from "@/lib/db/models/MasterPlanConfig";
import { PackageConfigModel } from "@/lib/db/models/PackageConfig";

export async function POST(req: NextRequest) {
  // ── Auth: super_admin only ─────────────────────────────────────────
  const token = await getServerToken(req);
  if (token?.role !== "super_admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // ── Explicit confirmation required ────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  if (body.confirm !== "DELETE_ALL_PACKAGES") {
    return NextResponse.json(
      { error: "confirmation_required", hint: 'Send { confirm: "DELETE_ALL_PACKAGES" }' },
      { status: 400 },
    );
  }

  try {
    await connectDB();

    // Delete all MasterPlanConfig documents
    const masterResult = await MasterPlanConfigModel.deleteMany({});

    // Delete all PackageConfig documents
    const packageResult = await PackageConfigModel.deleteMany({});

    return NextResponse.json({
      ok: true,
      deleted: {
        masterPlanConfig: masterResult.deletedCount,
        packageConfig:    packageResult.deletedCount,
        total:            masterResult.deletedCount + packageResult.deletedCount,
      },
      message: "All Packages data purged successfully. Models retained for dependent features.",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "server_error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
