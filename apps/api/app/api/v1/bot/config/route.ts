/**
 * GET /api/v1/bot/config
 * Returns public bot configuration for the widget (colors, name, intro).
 * Auth: x-api-key (public key)
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, corsHeaders } from "@/lib/middleware/apiKeyAuth";
import dbConnect from "@/lib/db/connect";
import BotConfigModel from "@/models/botConfig";

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

export async function GET(req: NextRequest) {
  const cors = corsHeaders(req);
  const auth = await authenticateRequest(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status, headers: cors });
  }

  await dbConnect();
  const config = await BotConfigModel.findOne({ tenantId: auth.tenant._id }).lean();

  const defaults = {
    botName: "Zudobot",
    botIntro: "สวัสดีค่ะ! มีอะไรให้ช่วยไหมคะ? 😊",
    themeColor: "#6366f1",
    logoUrl: "",
    position: "bottom-right",
    primaryLanguage: "th",
  };

  return NextResponse.json({
    ok: true,
    config: {
      botName:         config?.botName         ?? defaults.botName,
      botIntro:        config?.botIntro         ?? defaults.botIntro,
      themeColor:      config?.themeColor       ?? defaults.themeColor,
      logoUrl:         config?.logoUrl          ?? defaults.logoUrl,
      position:        config?.position         ?? defaults.position,
      primaryLanguage: config?.primaryLanguage  ?? defaults.primaryLanguage,
    },
  }, { status: 200, headers: cors });
}
