import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getServerToken } from "@/lib/auth/getServerToken";
import { connectDB } from "@/lib/db/connect";
import { UserModel } from "@/lib/db/models/User";
import { TenantProfileModel } from "@/lib/db/models/TenantProfile";
import crypto from "crypto";
import {
  defaultWelcomeMessage,
  isBotGender,
  type BotGender,
} from "@/lib/ai/botPersonality";
import { AMPLIFY_CONFIG } from "@/lib/env/amplifyGuardrail";
import { getPostgresDb } from "@/lib/db/postgres";
import { businessCategories, signupPurposes } from "@/lib/db/pg/schema";
import { ensureMasterData } from "@/lib/db/pg/ensureMasterData";

interface OnboardingBody {
  purposeId: string;
  businessCategoryId: string;
  orgName: string;
  websiteUrl?: string;
  botName: string;
  botGender: BotGender;
  botTone: "friendly" | "formal" | "playful";
  welcomeMessage: string;
  widgetColor: string;
  widgetPosition: "bottom-right" | "bottom-left";
}

export async function POST(req: NextRequest) {
  const token = await getServerToken(req);
  if (!token?.sub) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // อ่าน PDPA consent timestamp จาก cookie (set โดย register page หรือ onboarding PDPA step)
  const pdpaCookieRaw = req.cookies.get("zudo-pdpa-consent")?.value;
  const pdpaConsentAt = pdpaCookieRaw
    ? new Date(parseInt(pdpaCookieRaw, 10))
    : new Date();

  let body: OnboardingBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const {
    purposeId, businessCategoryId, orgName,
    botName, botGender, botTone, welcomeMessage, widgetColor, widgetPosition, websiteUrl,
  } = body;

  if (
    !purposeId?.trim() || !businessCategoryId?.trim() ||
    !orgName?.trim() ||
    !botName?.trim() || !isBotGender(botGender)
  ) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  // Validate the master-data refs against Postgres before touching Mongo.
  // ensureMasterData() self-provisions the tables/rows on first use so a
  // freshly deployed environment doesn't 500 on "relation does not exist".
  let purposeRow: { id: string; nameTh: string } | undefined;
  let categoryRow: { id: string; nameTh: string } | undefined;
  try {
    await ensureMasterData();
    const pgDb = getPostgresDb();
    [purposeRow] = await pgDb
      .select({ id: signupPurposes.id, nameTh: signupPurposes.nameTh })
      .from(signupPurposes)
      .where(eq(signupPurposes.id, purposeId))
      .limit(1);
    [categoryRow] = await pgDb
      .select({ id: businessCategories.id, nameTh: businessCategories.nameTh })
      .from(businessCategories)
      .where(eq(businessCategories.id, businessCategoryId))
      .limit(1);
  } catch (err) {
    console.error("[onboarding/complete] master-data lookup failed:", err);
    return NextResponse.json({ error: "master_data_unavailable" }, { status: 503 });
  }
  if (!purposeRow || !categoryRow) {
    return NextResponse.json({ error: "invalid_master_data" }, { status: 400 });
  }

  const businessName = orgName.trim();
  const businessType = categoryRow.nameTh;

  try {
    await connectDB();

    const isPending = !!(token as { pendingRegistration?: boolean }).pendingRegistration;
    let tenantId: string;

    if (isPending) {
      // C path: first time completion — create the User document now
      const email    = (token.email as string | undefined)?.toLowerCase();
      const googleId = (token as { googleSub?: string }).googleSub ?? (token.sub as string);
      if (!email) return NextResponse.json({ error: "missing_email" }, { status: 400 });

      // Idempotent: find by googleId in case of duplicate submission
      let user = await UserModel.findOne({ googleId });
      if (!user) {
        user = await UserModel.create({
          email,
          name:     (token.name as string | undefined) ?? email,
          googleId,
          image:    (token.picture as string | undefined) ?? undefined,
          role:     "tenant",
          roles:    ["tenant"],
          botState: "trial",
          trialEndsAt:        new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          onboardingComplete: true,
          pdpaConsentAt,
        });
        await UserModel.findByIdAndUpdate(user._id, { tenantId: user._id.toString() });
      } else if (!user.onboardingComplete) {
        await UserModel.findByIdAndUpdate(user._id, {
          onboardingComplete: true,
          trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        });
      }
      tenantId = user._id.toString();
    } else {
      // B-compatible path: User already exists (existing accounts / legacy)
      tenantId = token.sub as string;
      await UserModel.findByIdAndUpdate(tenantId, {
        onboardingComplete: true,
        botState: "trial",
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      });
    }

    const embedKey = crypto.randomBytes(16).toString("hex");

    await TenantProfileModel.findOneAndUpdate(
      { tenantId },
      {
        tenantId,
        businessName,
        businessType,
        websiteUrl:   websiteUrl?.trim(),
        purposeId,
        businessCategoryId,
        orgName,
        botName:      botName.trim(),
        botGender,
        botTone,
        welcomeMessage:
          welcomeMessage?.trim() || defaultWelcomeMessage(botName.trim(), botGender),
        widgetColor:    widgetColor || "#1E5BC6",
        widgetPosition: widgetPosition || "bottom-right",
        widgetEnabled:  false,
        embedKey,
        trialStartedAt: new Date(),
      },
      { upsert: true, new: true }
    );

    const res = NextResponse.json({ ok: true }, { status: 200 });
    // Short-lived bypass cookie so middleware skips the onboarding redirect
    // for the next navigation without needing a JWT refresh.
    const isHttps = AMPLIFY_CONFIG.authUrl.startsWith("https://");
    res.cookies.set("zudo-onboarded", "1", {
      httpOnly: true,
      secure: isHttps,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days — matches session lifetime
      path: "/",
    });
    return res;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "server_error";
    console.error("[onboarding/complete]", msg);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
