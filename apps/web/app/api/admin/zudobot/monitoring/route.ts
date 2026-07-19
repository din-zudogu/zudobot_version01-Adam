import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { connectDB } from "@/lib/db/connect";
import { UserModel } from "@/lib/db/models/User";
import { TenantProfileModel } from "@/lib/db/models/TenantProfile";
import { PartnerProfileModel } from "@/lib/db/models/PartnerProfile";

export const dynamic = "force-dynamic";

type MonitoringRow = {
  name: string;
  email: string;
  tenantId: string;
  currentPackage: string;
  registeredWebsites: string[];
  partnerRefId?: string;
  createdAt?: Date;
};

export async function GET(req: NextRequest) {
  try {
    const token = await getServerToken(req);
    if (token?.role !== "super_admin" && token?.role !== "admin") {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    if (!process.env.MONGO_URI) {
      throw new Error("CRITICAL: MONGO_URI missing from AWS Amplify runtime");
    }

    await connectDB();

    const { searchParams } = new URL(req.url);
    const viewMode = searchParams.get("viewMode");

    if (viewMode === "partner") {
      const partners = await PartnerProfileModel.find({ deletedAt: { $exists: false } })
        .select("userId companyName email createdAt")
        .lean();

      const partnerUserIds = partners.map((p) => p.userId).filter(Boolean);
      const tenantUsers = await UserModel.find({
        role: "tenant",
        tenantId: { $in: partnerUserIds },
      })
        .select("name email tenantId createdAt")
        .lean();

      const partnerByUserId = new Map(partners.map((p) => [p.userId, p]));
      const tenantIds = tenantUsers
        .map((u) => u.tenantId)
        .filter((id): id is string => typeof id === "string" && id.length > 0);

      const profiles = await TenantProfileModel.find({ tenantId: { $in: tenantIds } })
        .select("tenantId allowedDomain allowedDomains")
        .lean();
      const profileByTenant = new Map(profiles.map((p) => [p.tenantId, p]));

      const monitoringData: MonitoringRow[] = tenantUsers.map((u) => {
        const tenantId = u.tenantId ?? "";
        const partner = tenantId ? partnerByUserId.get(tenantId) : undefined;
        const profile = tenantId ? profileByTenant.get(tenantId) : undefined;
        const websites = [
          ...(profile?.allowedDomain ? [profile.allowedDomain] : []),
          ...((profile?.allowedDomains ?? []).filter(Boolean)),
        ];
        return {
          name: u.name,
          email: u.email,
          tenantId,
          currentPackage: "Partner Managed",
          registeredWebsites: Array.from(new Set(websites)),
          partnerRefId: partner?._id?.toString(),
          createdAt: u.createdAt,
        };
      });

      return NextResponse.json({ success: true, data: monitoringData });
    }

    const tenantUsers = await UserModel.find({ role: "tenant" })
      .select("name email tenantId createdAt")
      .sort({ createdAt: -1 })
      .lean();

    const tenantIds = tenantUsers
      .map((u) => u.tenantId ?? u._id.toString())
      .filter((id): id is string => typeof id === "string" && id.length > 0);

    const profiles = await TenantProfileModel.find({ tenantId: { $in: tenantIds } })
      .select("tenantId allowedDomain allowedDomains")
      .lean();
    const profileByTenant = new Map(profiles.map((p) => [p.tenantId, p]));

    const monitoringData: MonitoringRow[] = tenantUsers.map((u) => {
      const tenantId = u.tenantId ?? u._id.toString();
      const profile = profileByTenant.get(tenantId);
      const websites = [
        ...(profile?.allowedDomain ? [profile.allowedDomain] : []),
        ...((profile?.allowedDomains ?? []).filter(Boolean)),
      ];

      return {
        name: u.name,
        email: u.email,
        tenantId,
        currentPackage: "Standard Tier",
        registeredWebsites: Array.from(new Set(websites)),
        createdAt: u.createdAt,
      };
    });

    return NextResponse.json({ success: true, data: monitoringData });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "server_error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
