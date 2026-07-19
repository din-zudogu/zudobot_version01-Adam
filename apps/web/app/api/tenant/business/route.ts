import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getServerToken } from "@/lib/auth/getServerToken";
import { connectDB } from "@/lib/db/connect";
import { TenantProfileModel } from "@/lib/db/models/TenantProfile";
import { getPostgresDb } from "@/lib/db/postgres";
import { businessCategories } from "@/lib/db/pg/schema";
import { ensureMasterData } from "@/lib/db/pg/ensureMasterData";

export async function GET(req: NextRequest) {
  const token = await getServerToken(req);
  if (!token?.sub || token.role !== "tenant") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  await connectDB();
  const profile = await TenantProfileModel.findOne({ tenantId: token.sub })
    .select("orgName businessName businessCategoryId")
    .lean();
  if (!profile) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({
    orgName: profile.orgName ?? profile.businessName ?? "",
    businessCategoryId: profile.businessCategoryId ?? "",
  });
}

export async function PUT(req: NextRequest) {
  const token = await getServerToken(req);
  if (!token?.sub || token.role !== "tenant") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { orgName?: string; businessCategoryId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const orgName = body.orgName?.trim();
  const businessCategoryId = body.businessCategoryId?.trim();
  if (!orgName || !businessCategoryId) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  if (orgName.length > 1000) {
    return NextResponse.json({ error: "org_name_too_long" }, { status: 400 });
  }

  let categoryRow: { id: string; nameTh: string } | undefined;
  try {
    await ensureMasterData();
    const pgDb = getPostgresDb();
    [categoryRow] = await pgDb
      .select({ id: businessCategories.id, nameTh: businessCategories.nameTh })
      .from(businessCategories)
      .where(eq(businessCategories.id, businessCategoryId))
      .limit(1);
  } catch (err) {
    console.error("[tenant/business] master-data lookup failed:", err);
    return NextResponse.json({ error: "master_data_unavailable" }, { status: 503 });
  }
  if (!categoryRow) {
    return NextResponse.json({ error: "invalid_business_category" }, { status: 400 });
  }

  await connectDB();
  const profile = await TenantProfileModel.findOneAndUpdate(
    { tenantId: token.sub },
    {
      $set: {
        orgName,
        businessName: orgName,
        businessCategoryId,
        businessType: categoryRow.nameTh,
      },
    },
    { new: true }
  );
  if (!profile) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
