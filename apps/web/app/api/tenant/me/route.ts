import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db/connect";
import { UserModel } from "@/lib/db/models/User";
import { TenantProfileModel } from "@/lib/db/models/TenantProfile";
import { SubscriptionModel } from "@/lib/db/models/Subscription";
import { PackageConfigModel } from "@/lib/db/models/PackageConfig";
import { ReadyPackageModel } from "@/lib/db/models/ReadyPackage";
import { getPlatformSettings } from "@/lib/db/models/PlatformSettings";
import { ensureTenantProfileForUser } from "@/lib/tenant/ensureTenantProfile";
import { VipTenantModel } from "@/lib/db/models/VipTenant";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = await getServerToken(req);
  if (!token?.sub || token.role !== "tenant") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();
    const tenantId = token.sub as string;

    const [user, sub, cfg] = await Promise.all([
      UserModel.findById(tenantId),
      SubscriptionModel.findOne({ tenantId }),
      getPlatformSettings(),
    ]);

    // Compute effective botState — VIP overrides trial/expired states
    const rawBotState = user?.botState ?? "trial";
    let effectiveBotState = rawBotState;
    let vipExpiresAt: Date | null = null;
    if (user?.email && !["active", "disabled", "suspended_payment"].includes(rawBotState)) {
      const now = new Date();
      const activeVip = await VipTenantModel.findOne({
        email:     user.email.toLowerCase(),
        isActive:  true,
        startDate: { $lte: now },
        endDate:   { $gte: now },
      })
        .sort({ endDate: -1 })
        .select("endDate")
        .lean() as { endDate: Date } | null;
      if (activeVip) {
        effectiveBotState = "active";
        vipExpiresAt      = activeVip.endDate;
        // Keep User.botState + isVip in sync without blocking the response
        void UserModel.updateOne(
          { _id: user._id },
          { $set: { botState: "active", isVip: true, vipExpiresAt: activeVip.endDate } },
        ).catch(() => {});
      }
    }

    const profile =
      (await TenantProfileModel.findOne({ tenantId })) ??
      (await ensureTenantProfileForUser(tenantId));

    // Resolve plan labels + limits from PackageConfig
    let quotaLimit  = cfg.trialDailyQuotaCap;
    let planLabel   = "Trial";
    let planPriceThb = 0;
    let planMsgPerDay: number | undefined;
    let planMemoryMb: number | undefined;
    let planRetentionDays: number | undefined;
    let memoryLabel: string | undefined;
    let retentionLabel: string | undefined;
    let isMonthlyQuota = false;

    if (sub && sub.planId !== "trial") {
      const [planPkg, memPkg, retPkg] = await Promise.all([
        PackageConfigModel.findOne({ packageId: sub.planId }),
        PackageConfigModel.findOne({ packageId: sub.memoryAddonId }),
        PackageConfigModel.findOne({ packageId: sub.retentionAddonId }),
      ]);
      if (planPkg) {
        quotaLimit       = planPkg.msgPerDay ?? cfg.trialDailyQuotaCap;
        planLabel        = planPkg.label;
        planPriceThb     = planPkg.priceThb;
        planMsgPerDay    = planPkg.msgPerDay ?? undefined;
      }
      if (memPkg) { planMemoryMb = memPkg.memoryMb ?? undefined; memoryLabel = memPkg.label; }
      if (retPkg) { planRetentionDays = retPkg.retentionDays ?? undefined; retentionLabel = retPkg.label; }
    } else if (sub?.readyPackageId) {
      // Trial subscription linked to a specific ready package (e.g. "ZUDOBOT
      // FREE - LIFE TIME") — show that package's own quota/name instead of
      // the generic platform trial default, matching quotaGate.ts's
      // resolveLimits() so the dashboard and the actual chat gate agree.
      const pkg = await ReadyPackageModel.findById(sub.readyPackageId).lean();
      const aiBaseItem  = pkg?.items.find((i) => i.plan.toLowerCase().includes("ai base"));
      const expiredItem = pkg?.items.find((i) => i.plan.toLowerCase().includes("expired"));
      if (aiBaseItem?.messageCount != null) {
        quotaLimit        = aiBaseItem.messageCount;
        planLabel         = sub.readyPackageName ?? pkg?.name ?? "Trial";
        planRetentionDays = expiredItem?.storageExpireDays;
        isMonthlyQuota    = true;
      }
    }

    const quotaUsed = isMonthlyQuota
      ? (profile?.monthlyMessageCount ?? 0)
      : (profile?.dailyMessageCount ?? 0);

    return NextResponse.json({
      tenantId,
      user: {
        name:              user?.name ?? "",
        email:             user?.email ?? "",
        botState:          effectiveBotState,
        trialEndsAt:       user?.trialEndsAt ?? null,
        isVip:             user?.isVip ?? false,
        vipExpiresAt:      vipExpiresAt ?? user?.vipExpiresAt ?? null,
        hasPassword:       !!user?.passwordHash,
        twoFactorEnabled:  user?.twoFactorEnabled  ?? false,
        twoFactorVerified: user?.twoFactorVerified ?? false,
      },
      profile: {
        businessName:        profile?.businessName ?? "",
        botName:             profile?.botName ?? "Zudobot",
        botGender:           profile?.botGender ?? "female",
        botTone:             profile?.botTone ?? "friendly",
        welcomeMessage:      profile?.welcomeMessage ?? "",
        websiteUrl:          profile?.websiteUrl ?? "",
        widgetColor:         profile?.widgetColor ?? "#1E5BC6",
        widgetPosition:      profile?.widgetPosition ?? "bottom-right",
        widgetEnabled:       profile?.widgetEnabled ?? false,
        embedKey:            profile?.embedKey ?? "",
        dailyMessageCount:   quotaUsed,
        dailyMessageResetAt: profile?.dailyMessageResetAt ?? null,
        totalMessageCount:   profile?.totalMessageCount ?? 0,
      },
      subscription: sub ? {
        planId:            sub.planId,
        memoryAddonId:     sub.memoryAddonId,
        retentionAddonId:  sub.retentionAddonId,
        status:            sub.status,
        currentPeriodEnd:  sub.currentPeriodEnd ?? null,
        totalThb:          sub.totalThb,
        cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
        graceDueDate:      sub.graceDueDate ?? null,
      } : null,
      plan: {
        id:            sub?.planId ?? "trial",
        label:         planLabel,
        msgPerDay:     planMsgPerDay,
        memoryMb:      planMemoryMb,
        retentionDays: planRetentionDays,
        priceThb:      planPriceThb,
        memoryLabel,
        retentionLabel,
      },
      quota: {
        used:      quotaUsed,
        limit:     quotaLimit < 0 ? -1 : quotaLimit,
        percent:   quotaLimit <= 0 ? 0 : Math.min(100, Math.round((quotaUsed / quotaLimit) * 100)),
        resetAt:   isMonthlyQuota ? (profile?.monthlyMessageResetAt ?? null) : (profile?.dailyMessageResetAt ?? null),
        isMonthly: isMonthlyQuota,
      },
      settings: {
        widgetCdnBase:  cfg.widgetCdnBaseUrl,
        widgetVersion:  cfg.widgetStableVersion,
      },
    });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const token = await getServerToken(req);
  if (!token?.sub || token.role !== "tenant") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { name?: string; currentPassword?: string; newPassword?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid_body" }, { status: 400 }); }

  try {
    await connectDB();
    const update: Record<string, unknown> = {};

    if (body.name?.trim()) update.name = body.name.trim();

    if (body.newPassword) {
      if (!body.currentPassword) {
        return NextResponse.json({ error: "current_password_required" }, { status: 400 });
      }
      const user = await UserModel.findById(token.sub).select("passwordHash");
      if (!user?.passwordHash) {
        return NextResponse.json({ error: "google_account_no_password" }, { status: 400 });
      }
      if (!(await bcrypt.compare(body.currentPassword, user.passwordHash))) {
        return NextResponse.json({ error: "wrong_password" }, { status: 400 });
      }
      if (body.newPassword.length < 8) {
        return NextResponse.json({ error: "password_too_short" }, { status: 400 });
      }
      update.passwordHash = await bcrypt.hash(body.newPassword, 12);
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "nothing_to_update" }, { status: 400 });
    }

    await UserModel.findByIdAndUpdate(token.sub, { $set: update });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
