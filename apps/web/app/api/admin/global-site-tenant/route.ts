import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { requireAdminSession, verifyAdminStepUpToken } from "@/lib/admin/globalBotAdminAuth";
import { ensurePlatformSiteTenantProfile } from "@/lib/platform/ensurePlatformSiteTenantProfile";

export const dynamic = "force-dynamic";

type GlobalSiteTenantData = {
  botName: string;
  welcomeMessage: string;
  botTone: "friendly" | "formal" | "playful";
  botGender: "female" | "male";
  widgetColor: string;
  widgetPosition: "bottom-right" | "bottom-left";
  widgetEnabled: boolean;
  allowedDomain: string;
  lineEnabled: boolean;
  lineChannelSecret: string;
  lineChannelToken: string;
  lineOmniEnabled: boolean;
  lineLiffId: string;
  metaEnabled: boolean;
  metaAppSecret: string;
  metaPageAccessToken: string;
  metaPageId: string;
  metaVerifyToken: string;
  tiktokEnabled: boolean;
  tiktokAccessToken: string;
  tiktokWebhookSecret: string;
};

function serialize(profile: {
  botName: string;
  welcomeMessage: string;
  botTone: string;
  botGender: string;
  widgetColor: string;
  widgetPosition: string;
  widgetEnabled: boolean;
  allowedDomain: string;
  lineEnabled: boolean;
  lineChannelSecret?: string;
  lineChannelToken?: string;
  lineOmniEnabled: boolean;
  lineLiffId?: string;
  metaEnabled: boolean;
  metaAppSecret?: string;
  metaPageAccessToken?: string;
  metaPageId?: string;
  metaVerifyToken?: string;
  tiktokEnabled: boolean;
  tiktokAccessToken?: string;
  tiktokWebhookSecret?: string;
}): GlobalSiteTenantData {
  return {
    botName:        profile.botName,
    welcomeMessage: profile.welcomeMessage,
    botTone:        profile.botTone as GlobalSiteTenantData["botTone"],
    botGender:      profile.botGender as GlobalSiteTenantData["botGender"],
    widgetColor:    profile.widgetColor,
    widgetPosition: profile.widgetPosition as GlobalSiteTenantData["widgetPosition"],
    widgetEnabled:  profile.widgetEnabled,
    allowedDomain:  profile.allowedDomain ?? "",
    lineEnabled:         profile.lineEnabled,
    lineChannelSecret:   profile.lineChannelSecret ?? "",
    lineChannelToken:    profile.lineChannelToken ?? "",
    lineOmniEnabled:     profile.lineOmniEnabled,
    lineLiffId:          profile.lineLiffId ?? "",
    metaEnabled:         profile.metaEnabled,
    metaAppSecret:       profile.metaAppSecret ?? "",
    metaPageAccessToken: profile.metaPageAccessToken ?? "",
    metaPageId:          profile.metaPageId ?? "",
    metaVerifyToken:     profile.metaVerifyToken ?? "",
    tiktokEnabled:       profile.tiktokEnabled,
    tiktokAccessToken:   profile.tiktokAccessToken ?? "",
    tiktokWebhookSecret: profile.tiktokWebhookSecret ?? "",
  };
}

export async function GET(req: NextRequest) {
  try {
    await requireAdminSession(req);
    await connectDB();
    const profile = await ensurePlatformSiteTenantProfile();
    return NextResponse.json({ success: true, data: serialize(profile) });
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
      | (Partial<GlobalSiteTenantData> & { secureToken?: string })
      | null;

    if (!body) {
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
        {
          error:
            "รหัสรักษาความปลอดภัยจาก Google Authenticator ไม่ถูกต้อง หรือหมดอายุแล้ว กรุณาลองใหม่อีกครั้ง",
        },
        { status: 403 }
      );
    }

    await connectDB();
    const profile = await ensurePlatformSiteTenantProfile();

    if (typeof body.botName === "string")        profile.botName = body.botName.trim();
    if (typeof body.welcomeMessage === "string") profile.welcomeMessage = body.welcomeMessage.trim();
    if (body.botTone === "friendly" || body.botTone === "formal" || body.botTone === "playful") {
      profile.botTone = body.botTone;
    }
    if (body.botGender === "female" || body.botGender === "male") {
      profile.botGender = body.botGender;
    }
    if (typeof body.widgetColor === "string") profile.widgetColor = body.widgetColor.trim();
    if (body.widgetPosition === "bottom-right" || body.widgetPosition === "bottom-left") {
      profile.widgetPosition = body.widgetPosition;
    }
    if (typeof body.widgetEnabled === "boolean") profile.widgetEnabled = body.widgetEnabled;
    if (typeof body.allowedDomain === "string") {
      const domain = body.allowedDomain.trim();
      profile.allowedDomain = domain;
      if (domain && !profile.allowedDomains.includes(domain)) profile.allowedDomains.push(domain);
    }

    if (typeof body.lineEnabled === "boolean") profile.lineEnabled = body.lineEnabled;
    if (typeof body.lineChannelSecret === "string") profile.lineChannelSecret = body.lineChannelSecret.trim();
    if (typeof body.lineChannelToken === "string") profile.lineChannelToken = body.lineChannelToken.trim();
    if (typeof body.lineOmniEnabled === "boolean") profile.lineOmniEnabled = body.lineOmniEnabled;
    if (typeof body.lineLiffId === "string") profile.lineLiffId = body.lineLiffId.trim();

    if (typeof body.metaEnabled === "boolean") profile.metaEnabled = body.metaEnabled;
    if (typeof body.metaAppSecret === "string") profile.metaAppSecret = body.metaAppSecret.trim();
    if (typeof body.metaPageAccessToken === "string") profile.metaPageAccessToken = body.metaPageAccessToken.trim();
    if (typeof body.metaPageId === "string") profile.metaPageId = body.metaPageId.trim();
    if (typeof body.metaVerifyToken === "string") profile.metaVerifyToken = body.metaVerifyToken.trim();

    if (typeof body.tiktokEnabled === "boolean") profile.tiktokEnabled = body.tiktokEnabled;
    if (typeof body.tiktokAccessToken === "string") profile.tiktokAccessToken = body.tiktokAccessToken.trim();
    if (typeof body.tiktokWebhookSecret === "string") profile.tiktokWebhookSecret = body.tiktokWebhookSecret.trim();

    await profile.save();

    return NextResponse.json({ success: true, data: serialize(profile) });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "server_error";
    const status = message === "forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
