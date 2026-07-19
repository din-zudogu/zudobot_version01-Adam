import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { PlatformGlobalBotConfigModel } from "@/lib/db/models/PlatformGlobalBotConfig";
import { requireAdminSession, verifyAdminStepUpToken } from "@/lib/admin/globalBotAdminAuth";
import { resolveGlobalEmbedKey } from "@/lib/platform/resolveGlobalEmbedKey";

export const dynamic = "force-dynamic";

function serializeConfig(config: {
  botName: string;
  welcomeMessage: string;
  themeColor: string;
  avatarUrl: string;
  whitelistedDomains: string[];
  globalEmbedKey: string;
}) {
  return {
    botName: config.botName,
    welcomeMessage: config.welcomeMessage,
    themeColor: config.themeColor,
    avatarUrl: config.avatarUrl ?? "",
    whitelistedDomains: config.whitelistedDomains ?? [],
    globalEmbedKey: config.globalEmbedKey,
    globalChatTenantId: process.env.PLATFORM_GLOBAL_CHAT_TENANT_ID?.trim() ?? "",
  };
}

async function loadOrCreateGlobalConfig(globalEmbedKey: string) {
  await connectDB();

  let config = await PlatformGlobalBotConfigModel.findOne({ globalEmbedKey });

  if (!config) {
    const anyExisting = await PlatformGlobalBotConfigModel.findOne().sort({ updatedAt: -1 });
    if (anyExisting) {
      if (anyExisting.globalEmbedKey !== globalEmbedKey) {
        anyExisting.globalEmbedKey = globalEmbedKey;
        await anyExisting.save();
      }
      return anyExisting;
    }

    config = await PlatformGlobalBotConfigModel.create({
      globalEmbedKey,
      botName: "Zudobot แอดมินหลัก",
      welcomeMessage: "สวัสดีครับ มีอะไรให้ผมช่วยเหลือไหมครับ",
      themeColor: "#3B82F6",
      avatarUrl: "",
      whitelistedDomains: [],
    });
  }

  return config;
}

export async function GET(req: NextRequest) {
  try {
    if (!process.env.MONGO_URI?.trim()) {
      return NextResponse.json(
        { error: "AWS Amplify Configuration Error: MONGO_URI is missing." },
        { status: 500 }
      );
    }

    await requireAdminSession(req);

    const globalEmbedKey = await resolveGlobalEmbedKey();
    const config = await loadOrCreateGlobalConfig(globalEmbedKey);

    return NextResponse.json({
      success: true,
      data: serializeConfig(config),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "server_error";
    const status = message === "forbidden" ? 403 : 500;
    return NextResponse.json(
      { error: `Internal Server Error: ${message}` },
      { status }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.MONGO_URI?.trim()) {
      return NextResponse.json(
        { error: "AWS Amplify Configuration Error: MONGO_URI is missing." },
        { status: 500 }
      );
    }

    await requireAdminSession(req);

    const body = (await req.json().catch(() => null)) as
      | {
          botName?: string;
          welcomeMessage?: string;
          themeColor?: string;
          avatarUrl?: string;
          secureToken?: string;
        }
      | null;

    if (!body?.botName?.trim() || !body.welcomeMessage?.trim() || !body.themeColor?.trim()) {
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

    const globalEmbedKey = await resolveGlobalEmbedKey();
    await connectDB();

    const updatedConfig = await PlatformGlobalBotConfigModel.findOneAndUpdate(
      { globalEmbedKey },
      {
        botName: body.botName.trim(),
        welcomeMessage: body.welcomeMessage.trim(),
        themeColor: body.themeColor.trim(),
        ...(typeof body.avatarUrl === "string"
          ? { avatarUrl: body.avatarUrl.trim() }
          : {}),
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
        runValidators: true,
      }
    );

    if (!updatedConfig) {
      return NextResponse.json(
        { error: "Internal Server Error: Failed to persist global bot config." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: serializeConfig(updatedConfig),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "server_error";
    const status = message === "forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
