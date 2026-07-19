import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { ProductModel } from "@/lib/db/models/Product";
import { requireAdminSession, verifyAdminStepUpToken } from "@/lib/admin/globalBotAdminAuth";
import { ensurePlatformSiteTenantProfile } from "@/lib/platform/ensurePlatformSiteTenantProfile";

export const dynamic = "force-dynamic";

async function verifyToken(secureToken: unknown): Promise<NextResponse | null> {
  if (typeof secureToken !== "string" || secureToken.length !== 6) {
    return NextResponse.json(
      { error: "กรุณาระบุรหัสยืนยันความปลอดภัยความยาว 6 หลักจากแอปพลิเคชัน" },
      { status: 400 }
    );
  }
  const isTokenValid = await verifyAdminStepUpToken(secureToken);
  if (!isTokenValid) {
    return NextResponse.json(
      { error: "รหัสรักษาความปลอดภัยไม่ถูกต้อง หรือหมดอายุแล้ว กรุณาลองใหม่อีกครั้ง" },
      { status: 403 }
    );
  }
  return null;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminSession(req);
    const { id } = await params;

    const body = (await req.json().catch(() => null)) as
      | (Record<string, unknown> & { secureToken?: string })
      | null;
    if (!body) return NextResponse.json({ error: "missing_fields" }, { status: 400 });

    const tokenError = await verifyToken(body.secureToken);
    if (tokenError) return tokenError;

    await connectDB();
    const profile = await ensurePlatformSiteTenantProfile();

    const allowed = [
      "name", "price", "priceSuffix", "shortDescription", "slug",
      "stock", "imageUrl", "productUrl", "stripePaymentLink", "isActive",
    ] as const;
    const update: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body) update[key] = body[key];
    }

    const product = await ProductModel.findOneAndUpdate(
      { _id: id, tenantId: profile.tenantId },
      update,
      { new: true }
    );
    if (!product) return NextResponse.json({ error: "not_found" }, { status: 404 });

    return NextResponse.json({ success: true, data: product });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "server_error";
    const status = message === "forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminSession(req);
    const { id } = await params;

    const body = (await req.json().catch(() => ({}))) as { secureToken?: string };
    const tokenError = await verifyToken(body.secureToken);
    if (tokenError) return tokenError;

    await connectDB();
    const profile = await ensurePlatformSiteTenantProfile();

    const result = await ProductModel.deleteOne({ _id: id, tenantId: profile.tenantId });
    if (result.deletedCount === 0) return NextResponse.json({ error: "not_found" }, { status: 404 });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "server_error";
    const status = message === "forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
