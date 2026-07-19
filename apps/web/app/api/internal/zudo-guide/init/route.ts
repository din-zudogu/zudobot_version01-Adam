import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { connectDB } from "@/lib/db/connect";
import { TenantProfileModel } from "@/lib/db/models/TenantProfile";

export async function GET(req: NextRequest) {
  try {
    const token = await getServerToken(req);
    if (!token?.sub) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const embedKey = process.env.ZUDO_GUIDE_EMBED_KEY;
    if (!embedKey) {
      console.error("[zudo-guide/init] ZUDO_GUIDE_EMBED_KEY is not set in environment");
      return NextResponse.json({ ok: false, error: "guide_not_configured" }, { status: 500 });
    }

    await connectDB();

    const profile = await TenantProfileModel.findOne({ embedKey });
    if (!profile) {
      console.error("[zudo-guide/init] No TenantProfile found for embedKey:", embedKey.slice(0, 20) + "...");
      return NextResponse.json({ ok: false, error: "guide_not_found" }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      config: {
        botName:        profile.botName,
        welcomeMessage: profile.welcomeMessage,
        widgetColor:    profile.widgetColor,
      },
    });
  } catch (err) {
    console.error("[zudo-guide/init] Unexpected error:", err);
    return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
  }
}
