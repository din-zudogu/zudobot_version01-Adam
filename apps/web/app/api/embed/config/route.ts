import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { TenantProfileModel } from "@/lib/db/models/TenantProfile";

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (!key) return NextResponse.json({ ok: false, error: "missing_key" }, { status: 400 });

  await connectDB();
  const profile = await TenantProfileModel.findOne({ embedKey: key });

  if (!profile)              return NextResponse.json({ ok: false, error: "invalid_key"     }, { status: 403 });
  if (!profile.widgetEnabled) return NextResponse.json({ ok: false, error: "widget_disabled" }, { status: 403 });

  return NextResponse.json({
    ok:             true,
    botName:        profile.botName,
    welcomeMessage: profile.welcomeMessage,
    widgetColor:    profile.widgetColor,
    widgetPosition: profile.widgetPosition,
  });
}
