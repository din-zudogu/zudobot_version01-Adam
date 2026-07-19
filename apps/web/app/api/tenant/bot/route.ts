import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { connectDB } from "@/lib/db/connect";
import { TenantProfileModel } from "@/lib/db/models/TenantProfile";
import { isBotGender } from "@/lib/ai/botPersonality";

const ALLOWED = new Set([
  "botName",
  "botGender",
  "botTone",
  "welcomeMessage",
  "widgetColor",
  "widgetPosition",
  "widgetEnabled",
  "websiteUrl",
]);

export async function PUT(req: NextRequest) {
  const token = await getServerToken(req);
  if (!token?.sub || token.role !== "tenant") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid_body" }, { status: 400 }); }

  const update: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (ALLOWED.has(k) && v !== undefined) update[k] = v;
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "nothing_to_update" }, { status: 400 });
  }

  if ("botGender" in update && !isBotGender(update.botGender)) {
    return NextResponse.json({ error: "invalid_bot_gender" }, { status: 400 });
  }

  if (
    ("botName" in update || "botTone" in update || "welcomeMessage" in update) &&
    !("botGender" in update)
  ) {
    return NextResponse.json({ error: "bot_gender_required" }, { status: 400 });
  }

  if ("websiteUrl" in update) {
    const url = update.websiteUrl as string;
    if (url && !/^https?:\/\/.+/.test(url)) {
      return NextResponse.json({ error: "invalid_website_url" }, { status: 400 });
    }
    update.websiteUrl = url.trim().replace(/\/$/, "");
  }

  try {
    await connectDB();
    await TenantProfileModel.findOneAndUpdate({ tenantId: token.sub }, { $set: update });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
