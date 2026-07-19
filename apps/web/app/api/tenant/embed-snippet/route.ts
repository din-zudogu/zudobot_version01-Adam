import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { connectDB } from "@/lib/db/connect";
import { TenantProfileModel } from "@/lib/db/models/TenantProfile";
import { buildEmbedScript } from "@/lib/widget/embed-platforms/buildEmbedScript";
import { requirePublicAppUrl } from "@/lib/env/publicAppUrl";

export const dynamic = "force-dynamic";

/** PATH 1 — สร้างสคริปต์ฝังบนเซิร์ฟเวอร์ (ลูกค้าไม่ต้องพึ่ง env ฝั่ง browser) */
export async function GET(req: NextRequest) {
  const token = await getServerToken(req);
  if (!token?.sub || token.role !== "tenant") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();
    const tenantId = token.sub as string;
    const profile = await TenantProfileModel.findOne({ tenantId }).lean();
    if (!profile?.embedKey) {
      return NextResponse.json({ error: "no_embed_key" }, { status: 404 });
    }

    const allowedDomain =
      profile.allowedDomain?.trim() || profile.allowedDomains?.[0]?.trim() || "pending";

    const appUrl = requirePublicAppUrl();
    const embedScript = buildEmbedScript({
      tenantId,
      embedKey: profile.embedKey,
      allowedDomain,
      appUrl,
      scriptPath: "/widget.js",
    });

    return NextResponse.json({
      ok: true,
      embedScript,
      allowedDomain: profile.allowedDomain?.trim() || null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "build_failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
