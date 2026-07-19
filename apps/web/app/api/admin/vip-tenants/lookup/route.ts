/**
 * GET /api/admin/vip-tenants/lookup?email=xxx
 * Auto-detect existing TenantProfile by email → returns tenantId + tenantName
 */
import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { connectDB } from "@/lib/db/connect";
import { TenantProfileModel } from "@/lib/db/models/TenantProfile";

function requireAdmin(role?: string) {
  return role === "admin" || role === "super_admin";
}

export async function GET(req: NextRequest) {
  const token = await getServerToken(req);
  if (!requireAdmin(token?.role as string)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const email = req.nextUrl.searchParams.get("email")?.trim().toLowerCase() ?? "";
  if (!email.includes("@")) {
    return NextResponse.json({ found: false });
  }

  try {
    await connectDB();
    // TenantProfile stores tenantId as a string field (the owner's uid / email)
    const profile = await TenantProfileModel
      .findOne({ tenantId: email })
      .select("tenantId businessName")
      .lean() as { tenantId: string; businessName?: string } | null;

    if (!profile) return NextResponse.json({ found: false });

    return NextResponse.json({
      found:      true,
      tenantId:   profile.tenantId,
      tenantName: profile.businessName ?? "",
    });
  } catch {
    return NextResponse.json({ found: false });
  }
}
