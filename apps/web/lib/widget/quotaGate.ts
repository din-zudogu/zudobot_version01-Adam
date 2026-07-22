/**
 * Quota Gate — checks all plan limits before every widget chat message.
 *
 * Checks (in order):
 *   1. botState — suspended / disabled → block immediately
 *   2. Trial expiry
 *   3. Monthly message quota (msgPerMonth) for paid plans
 *   4. Daily message quota (msgPerDay) for trial plans
 *
 * After AI responds, call incrementUsage() to count the message and
 * fire in-app quota alert notifications when crossing 80 / 95 / 100%.
 */

import { connectDB } from "@/lib/db/connect";
import { UserModel } from "@/lib/db/models/User";
import { TenantProfileModel, type ITenantProfile } from "@/lib/db/models/TenantProfile";
import { SubscriptionModel } from "@/lib/db/models/Subscription";
import { PackageConfigModel } from "@/lib/db/models/PackageConfig";
import { ReadyPackageModel } from "@/lib/db/models/ReadyPackage";
import { NotificationModel } from "@/lib/db/models/Notification";
import { getPlatformSettings } from "@/lib/db/models/PlatformSettings";
import { isMemoryLimitExceeded } from "@/lib/memory/memoryService";
import { logSystemEventAsync } from "@/lib/logging/systemLogger";
import { applyReadyPackageToTenant } from "@/lib/payment/applyReadyPackage";

// ── Types ─────────────────────────────────────────────────────────

export interface QuotaLimits {
  msgPerDay?:        number;   // trial only — daily cap
  msgPerMonth?:      number;   // paid plans — monthly cap (-1 = unlimited)
  extraMsgPerMonth?: number;   // from quota add-on
  memoryMb?:         number;   // legacy memory limit (-1 = unlimited)
  retentionDays:     number;   // -1 = unlimited
  isTrial:           boolean;
  isMonthly:         boolean;  // true = use monthly counting
}

export interface QuotaCheckResult {
  allowed:      boolean;
  blockMessage: string;
  limits:       QuotaLimits;
  currentUsage: number;
}

// ── Helpers ───────────────────────────────────────────────────────

function isNewDay(resetAt: Date): boolean {
  const now = new Date();
  const todayMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return resetAt < todayMidnight;
}

function isNewMonth(resetAt: Date): boolean {
  const now = new Date();
  return (
    now.getUTCFullYear() > resetAt.getUTCFullYear() ||
    (now.getUTCFullYear() === resetAt.getUTCFullYear() &&
     now.getUTCMonth() > resetAt.getUTCMonth())
  );
}

async function resolveLimits(tenantId: string): Promise<QuotaLimits> {
  const [sub, cfg] = await Promise.all([
    SubscriptionModel.findOne({ tenantId }),
    getPlatformSettings(),
  ]);

  if (!sub || sub.planId === "trial" || sub.status === "trialing") {
    // A ready package's own terms (message quota, retention) take priority
    // over the platform-wide generic trial default, whenever the tenant's
    // subscription is actually linked to one — e.g. "ZUDOBOT FREE - LIFE
    // TIME" grants 30 msg/month, not the generic cfg.trialDailyQuotaCap.
    if (sub?.readyPackageId) {
      const pkg = await ReadyPackageModel.findById(sub.readyPackageId).lean();
      const aiBaseItem  = pkg?.items.find((i) => i.plan.toLowerCase().includes("ai base"));
      const expiredItem = pkg?.items.find((i) => i.plan.toLowerCase().includes("expired"));
      if (aiBaseItem?.messageCount != null) {
        return {
          msgPerMonth:   aiBaseItem.messageCount,
          retentionDays: expiredItem?.storageExpireDays ?? 7,
          isTrial:       true,
          isMonthly:     true,
        };
      }
    }
    return {
      msgPerDay:    cfg.trialDailyQuotaCap,
      retentionDays: 7,
      isTrial:      true,
      isMonthly:    false,
    };
  }

  const [planPkg, quotaPkg, retPkg] = await Promise.all([
    PackageConfigModel.findOne({ packageId: sub.planId }),
    // memoryAddonId now holds either quota_addon or memory_addon package IDs
    PackageConfigModel.findOne({ packageId: sub.memoryAddonId }),
    PackageConfigModel.findOne({ packageId: sub.retentionAddonId }),
  ]);

  const msgPerMonth   = planPkg?.msgPerMonth  ?? -1;
  const extraMsg      = quotaPkg?.extraMsgPerMonth ?? 0;
  const totalMonthly  = msgPerMonth < 0 ? -1 : msgPerMonth + extraMsg;
  const retentionDays = retPkg?.retentionDays ?? 7;

  // Legacy memory check (only for old memory_addon subscriptions)
  const memoryMb = quotaPkg?.packageType === "memory_addon"
    ? (quotaPkg.memoryMb ?? -1)
    : undefined;

  return {
    msgPerMonth:      totalMonthly,
    extraMsgPerMonth: extraMsg,
    memoryMb,
    retentionDays,
    isTrial:    false,
    isMonthly:  true,
  };
}

// ── Main gate ─────────────────────────────────────────────────────

export async function checkQuota(tenantId: string): Promise<QuotaCheckResult> {
  await connectDB();

  const [user, cfg] = await Promise.all([
    UserModel.findOne({ _id: tenantId }),
    getPlatformSettings(),
  ]);

  const SUSPENDED_STATES = new Set([
    "suspended_quota", "suspended_payment", "trial_expired",
    "pending_kyc", "disabled",
  ]);

  // 1. botState hard-blocks
  if (!user || SUSPENDED_STATES.has(user.botState ?? "")) {
    return {
      allowed: false,
      blockMessage: cfg.quotaExhaustedBotMessage,
      limits: { retentionDays: 0, isTrial: false, isMonthly: false },
      currentUsage: 0,
    };
  }

  // 2. Trial expiry — if the current ready package configures a fallback
  // package, auto-switch to it (and its terms) instead of expiring, so a
  // live chat request doesn't get blocked before the next daily cron run.
  if (user.botState === "trial" && user.trialEndsAt && user.trialEndsAt < new Date()) {
    const sub = await SubscriptionModel.findOne({ tenantId });
    const currentPkg = sub?.readyPackageId
      ? await ReadyPackageModel.findById(sub.readyPackageId).lean()
      : null;
    const fallbackPkg = currentPkg?.fallbackPackageId
      ? await ReadyPackageModel.findOne({ _id: currentPkg.fallbackPackageId, isActive: true }).lean()
      : null;

    if (fallbackPkg) {
      await applyReadyPackageToTenant(tenantId, fallbackPkg);
      logSystemEventAsync({
        category: "bot_state", action: "bot_state_change", email: user.email,
        details: {
          previousState: "trial", nextState: "trial", reason: "fallback_package_applied",
          fromPackageId: String(currentPkg?._id), toPackageId: String(fallbackPkg._id), toPackageName: fallbackPkg.name,
        },
      });
      // fall through — re-evaluate quota below using the newly applied package
    } else {
      await UserModel.findByIdAndUpdate(tenantId, { botState: "trial_expired" });
      logSystemEventAsync({
        category: "bot_state", action: "bot_state_change", email: user.email,
        details: { previousState: "trial", nextState: "trial_expired", reason: "trial_ended" },
      });
      return {
        allowed: false,
        blockMessage: cfg.quotaExhaustedBotMessage,
        limits: { retentionDays: 0, isTrial: true, isMonthly: false },
        currentUsage: 0,
      };
    }
  }

  const limits = await resolveLimits(tenantId);

  let profile = await TenantProfileModel.findOne({ tenantId });
  if (!profile) {
    return {
      allowed: false,
      blockMessage: cfg.quotaExhaustedBotMessage,
      limits,
      currentUsage: 0,
    };
  }

  // 3a. Monthly quota path (paid plans)
  if (limits.isMonthly) {
    if (isNewMonth(profile.monthlyMessageResetAt ?? new Date(0))) {
      const startOfMonth = new Date(Date.UTC(
        new Date().getUTCFullYear(),
        new Date().getUTCMonth(),
        1
      ));
      profile = (await TenantProfileModel.findOneAndUpdate(
        { tenantId },
        {
          $set: {
            monthlyMessageCount:   0,
            monthlyMessageResetAt: startOfMonth,
            quotaAlert80Sent:  false,
            quotaAlert95Sent:  false,
          },
        },
        { new: true }
      ))!;
    }

    const currentUsage = profile.monthlyMessageCount ?? 0;
    const cap = limits.msgPerMonth ?? -1;

    if (cap >= 0 && currentUsage >= cap) {
      return {
        allowed: false,
        blockMessage: cfg.quotaExhaustedBotMessage,
        limits,
        currentUsage,
      };
    }

    return { allowed: true, blockMessage: "", limits, currentUsage };
  }

  // 3b. Daily quota path (trial)
  if (isNewDay(profile.dailyMessageResetAt)) {
    profile = (await TenantProfileModel.findOneAndUpdate(
      { tenantId },
      {
        $set: {
          dailyMessageCount:   0,
          dailyMessageResetAt: new Date(),
          quotaAlert80Sent:    false,
          quotaAlert95Sent:    false,
        },
      },
      { new: true }
    ))!;
  }

  const currentUsage = profile.dailyMessageCount;
  const dailyCap = limits.msgPerDay ?? -1;

  if (dailyCap >= 0 && currentUsage >= dailyCap) {
    const blockMsg = limits.isTrial
      ? cfg.trialQuotaExhaustedBotMessage
      : cfg.quotaExhaustedBotMessage;

    if (limits.isTrial) {
      await UserModel.findByIdAndUpdate(tenantId, { botState: "trial_quota_daily_exhausted" });
      logSystemEventAsync({
        category: "bot_state", action: "bot_state_change", email: user.email,
        details: { previousState: user.botState, nextState: "trial_quota_daily_exhausted", reason: "daily_quota_exhausted" },
      });
    }

    return { allowed: false, blockMessage: blockMsg, limits, currentUsage };
  }

  // 4. Legacy memory quota check
  if (limits.memoryMb !== undefined && limits.memoryMb >= 0) {
    const memFull = await isMemoryLimitExceeded(tenantId, limits.memoryMb);
    if (memFull) {
      return {
        allowed: false,
        blockMessage: cfg.quotaExhaustedBotMessage,
        limits,
        currentUsage,
      };
    }
  }

  return { allowed: true, blockMessage: "", limits, currentUsage };
}

// ── Post-response accounting ──────────────────────────────────────

export async function incrementUsage(
  tenantId: string,
  profile:  ITenantProfile,
  limits:   QuotaLimits,
): Promise<void> {
  const [cfg] = await Promise.all([getPlatformSettings()]);
  const thresholds: number[] = cfg.quotaAlertThresholds ?? [80, 95];
  const t80 = thresholds[0] ?? 80;
  const t95 = thresholds[1] ?? 95;

  if (limits.isMonthly) {
    // Monthly counting path
    const newCount = (profile.monthlyMessageCount ?? 0) + 1;
    const cap = limits.msgPerMonth ?? -1;
    const percent = cap <= 0 ? 0 : Math.min(100, (newCount / cap) * 100);

    const update: Record<string, unknown> = {
      $inc: { monthlyMessageCount: 1, dailyMessageCount: 1, totalMessageCount: 1 },
    };

    const alertUpdates: Record<string, boolean> = {};
    const notifications: Promise<unknown>[] = [];

    if (percent >= t80 && !profile.quotaAlert80Sent) {
      alertUpdates.quotaAlert80Sent = true;
      notifications.push(
        NotificationModel.create({
          tenantId,
          type:      "quota_alert_80",
          title:     `โควต้าข้อความใกล้เต็ม (${Math.round(percent)}%)`,
          message:   `คุณใช้โควต้าไปแล้ว ${Math.round(percent)}% ของเดือนนี้ (${newCount}/${cap} ข้อความ) หากเต็มบอทจะหยุดตอบจนถึงต้นเดือนหน้า`,
          actionUrl: "/dashboard/billing",
        })
      );
    }

    if (percent >= t95 && !profile.quotaAlert95Sent) {
      alertUpdates.quotaAlert95Sent = true;
      notifications.push(
        NotificationModel.create({
          tenantId,
          type:      "quota_alert_95",
          title:     `โควต้าข้อความเหลือน้อยมาก (${Math.round(percent)}%)`,
          message:   `โควต้าเหลือน้อยกว่า ${100 - t95}% — บอทอาจหยุดตอบในเร็วๆ นี้ กรุณาอัปเกรดเพื่อไม่ให้การขายสะดุด`,
          actionUrl: "/dashboard/billing",
        })
      );
    }

    if (percent >= 100) {
      notifications.push(
        NotificationModel.create({
          tenantId,
          type:      "quota_exhausted",
          title:     "โควต้าข้อความหมดแล้ว",
          message:   `บอทหยุดตอบแล้ว เนื่องจากใช้ครบ ${cap} ข้อความ/เดือน โควต้าจะรีเซ็ตต้นเดือนหน้า`,
          actionUrl: "/dashboard/billing",
        })
      );
    }

    if (Object.keys(alertUpdates).length > 0) {
      (update as Record<string, unknown>).$set = alertUpdates;
    }

    await Promise.all([
      TenantProfileModel.findOneAndUpdate({ tenantId }, update),
      ...notifications,
    ]);

  } else {
    // Daily counting path (trial)
    const newCount = profile.dailyMessageCount + 1;
    const cap = limits.msgPerDay ?? -1;
    const percent = cap <= 0 ? 0 : Math.min(100, (newCount / cap) * 100);

    const update: Record<string, unknown> = {
      $inc: { dailyMessageCount: 1, totalMessageCount: 1 },
    };

    const alertUpdates: Record<string, boolean> = {};
    const notifications: Promise<unknown>[] = [];

    if (percent >= t80 && !profile.quotaAlert80Sent) {
      alertUpdates.quotaAlert80Sent = true;
      notifications.push(
        NotificationModel.create({
          tenantId,
          type:      "quota_alert_80",
          title:     `โควต้าข้อความใกล้เต็ม (${Math.round(percent)}%)`,
          message:   `คุณใช้โควต้าไปแล้ว ${Math.round(percent)}% ของวันนี้ (${newCount}/${cap} ข้อความ) หากเต็มบอทจะหยุดตอบจนถึงเที่ยงคืน`,
          actionUrl: "/dashboard/billing",
        })
      );
    }

    if (percent >= t95 && !profile.quotaAlert95Sent) {
      alertUpdates.quotaAlert95Sent = true;
      notifications.push(
        NotificationModel.create({
          tenantId,
          type:      "quota_alert_95",
          title:     `โควต้าข้อความเหลือน้อยมาก (${Math.round(percent)}%)`,
          message:   `โควต้าเหลือน้อยกว่า ${100 - t95}% — บอทอาจหยุดตอบในเร็วๆ นี้`,
          actionUrl: "/dashboard/billing",
        })
      );
    }

    if (percent >= 100) {
      notifications.push(
        NotificationModel.create({
          tenantId,
          type:      "quota_exhausted",
          title:     "โควต้าข้อความหมดแล้ว",
          message:   `บอทหยุดตอบแล้ว เนื่องจากใช้ครบ ${cap} ข้อความ/วัน โควต้าจะรีเซ็ตเที่ยงคืน UTC`,
          actionUrl: "/dashboard/billing",
        })
      );
    }

    if (Object.keys(alertUpdates).length > 0) {
      (update as Record<string, unknown>).$set = alertUpdates;
    }

    await Promise.all([
      TenantProfileModel.findOneAndUpdate({ tenantId }, update),
      ...notifications,
    ]);
  }
}
