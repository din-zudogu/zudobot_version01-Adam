import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { ProductModel } from "@/lib/db/models/Product";
import { requireAdminSession, verifyAdminStepUpToken } from "@/lib/admin/globalBotAdminAuth";
import { ensurePlatformSiteTenantProfile } from "@/lib/platform/ensurePlatformSiteTenantProfile";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await requireAdminSession(req);
    await connectDB();
    const profile = await ensurePlatformSiteTenantProfile();
    const products = await ProductModel.find({ tenantId: profile.tenantId })
      .sort({ createdAt: -1 })
      .lean();
    return NextResponse.json({ success: true, data: products });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "server_error";
    const status = message === "forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdminSession(req);

    const body = (await req.json().catch(() => null)) as
      | {
          name?: string;
          price?: number;
          priceSuffix?: string;
          shortDescription?: string;
          slug?: string;
          stock?: number | null;
          imageUrl?: string;
          productUrl?: string;
          stripePaymentLink?: string;
          isActive?: boolean;
          secureToken?: string;
        }
      | null;

    if (!body?.name?.trim()) {
      return NextResponse.json({ error: "missing_fields" }, { status: 400 });
    }
    if (!body.secureToken || body.secureToken.length !== 6) {
      return NextResponse.json(
        { error: "กรุณาระบุรหัสยืนยันความปลอดภัยความยาว 6 หลักจากแอปพลิเคชัน" },
        { status: 400 }
      );
    }
    const isTokenValid = await verifyAdminStepUpToken(body.secureToken);
    if (!isTokenValid) {
      return NextResponse.json(
        { error: "รหัสรักษาความปลอดภัยไม่ถูกต้อง หรือหมดอายุแล้ว กรุณาลองใหม่อีกครั้ง" },
        { status: 403 }
      );
    }

    await connectDB();
    const profile = await ensurePlatformSiteTenantProfile();

    const product = await ProductModel.create({
      tenantId:          profile.tenantId,
      name:              body.name.trim(),
      price:             body.price ?? 0,
      priceSuffix:       body.priceSuffix?.trim() ?? "",
      shortDescription:  body.shortDescription?.trim() ?? "",
      slug:              body.slug?.trim() ?? "",
      stock:             typeof body.stock === "number" ? body.stock : null,
      imageUrl:          body.imageUrl?.trim() || undefined,
      productUrl:        body.productUrl?.trim() || undefined,
      stripePaymentLink: body.stripePaymentLink?.trim() || undefined,
      isActive:          body.isActive ?? true,
    });

    return NextResponse.json({ success: true, data: product });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "server_error";
    const status = message === "forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
