import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/connect";
import { PlatformGlobalBotConfigModel } from "@/lib/db/models/PlatformGlobalBotConfig";
import {
  requireAdminSession,
  verifyAdminStepUpToken,
} from "@/lib/admin/globalBotAdminAuth";
import { normalizeWhitelistDomain } from "@/lib/platform/normalizeWhitelistDomain";
import { resolveGlobalEmbedKey } from "@/lib/platform/resolveGlobalEmbedKey";

export const dynamic = "force-dynamic";

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
      | { whitelistedDomains?: string[]; secureToken?: string }
      | null;

    if (!body || !Array.isArray(body.whitelistedDomains)) {
      return NextResponse.json({ error: "invalid_whitelist" }, { status: 400 });
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

    const normalized = body.whitelistedDomains
      .map((domain) => normalizeWhitelistDomain(domain))
      .filter((domain): domain is string => Boolean(domain));

    const uniqueDomains = Array.from(new Set(normalized));
    const globalEmbedKey = await resolveGlobalEmbedKey();

    await connectDB();

    const config = await PlatformGlobalBotConfigModel.findOneAndUpdate(
      { globalEmbedKey },
      {
        whitelistedDomains: uniqueDomains,
        botName: "Zudobot แอดมินหลัก",
        welcomeMessage: "สวัสดีครับ มีอะไรให้ผมช่วยเหลือไหมครับ",
        themeColor: "#3B82F6",
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
        runValidators: true,
      }
    );

    if (!config) {
      return NextResponse.json(
        { error: "Internal Server Error: Failed to persist whitelist." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Allowed Domains updated securely.",
      data: {
        whitelistedDomains: config.whitelistedDomains,
        globalEmbedKey: config.globalEmbedKey,
      },
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
