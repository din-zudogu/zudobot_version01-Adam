/**
 * Daily maintenance — runs via AWS EventBridge cron (Phase 8) or admin manually.
 *
 * Tasks:
 * 1. Reset daily message counters for all tenants
 * 2. Expire trials that passed trialEndsAt
 * 3. Expire grace periods that passed graceDueDate → suspended_payment
 * 4. Re-evaluate bot state for affected active subscriptions
 * 5. Clean up expired conversation sessions (belt-and-suspenders; TTL index is primary)
 * 6. Send retention warning notifications (N days before data expires)
 * 7. Send trial expiry warning notifications (3 days before trial ends)
 */

import { connectDB } from "@/lib/db/connect";
import { UserModel } from "@/lib/db/models/User";
import { TenantProfileModel } from "@/lib/db/models/TenantProfile";
import { SubscriptionModel } from "@/lib/db/models/Subscription";
import { PartnerProfileModel } from "@/lib/db/models/PartnerProfile";
import { ReadyPackageModel } from "@/lib/db/models/ReadyPackage";
import { getPlatformSettings } from "@/lib/db/models/PlatformSettings";
import { evaluateBotState, type BotStateContext } from "./botStateMachine";
import { applyReadyPackageToTenant } from "./applyReadyPackage";
import { dailyCapForPlan, DEFAULT_PM_CONFIG, type PlanId, PLAN_CATALOG, MEMORY_ADDON_CATALOG, RETENTION_ADDON_CATALOG, type MemoryAddonId, type RetentionAddonId } from "./pmRules";
import { cleanupExpiredSessions, getTenantsWithExpiringData } from "@/lib/memory/memoryService";
import { createNotification, notificationSentToday } from "@/lib/notifications/notificationService";
import { sendEmail, promptPayRenewalHtml } from "@/lib/email/resend";
import { AMPLIFY_CONFIG } from "@/lib/env/amplifyGuardrail";
import type { BotState } from "@/types";
import { logSystemEventAsync } from "@/lib/logging/systemLogger";

export interface DailyCheckResult {
  quotaReset:            number;
  trialExpired:          number;
  graceExpired:          number;
  stateTransitions:      number;
  sessionsCleared:       number;
  retentionWarnings:     number;
  trialWarnings:         number;
  promptPayReminders:    number;
  partnersHardDeleted:   number;
}

export async function runDailyCheck(now = new Date()): Promise<DailyCheckResult> {
  await connectDB();
  const result: DailyCheckResult = {
    quotaReset: 0, trialExpired: 0, graceExpired: 0, stateTransitions: 0,
    sessionsCleared: 0, retentionWarnings: 0, trialWarnings: 0, promptPayReminders: 0,
    partnersHardDeleted: 0,
  };

  const cfg = await getPlatformSettings();

  // ── 1. Reset daily message counters ────────────────────────────
  const midnightToday = new Date(now);
  midnightToday.setHours(0, 0, 0, 0);

  const quotaResetResult = await TenantProfileModel.updateMany(
    { dailyMessageResetAt: { $lt: midnightToday } },
    { $set: { dailyMessageCount: 0, dailyMessageResetAt: midnightToday } }
  );
  result.quotaReset = quotaResetResult.modifiedCount;

  // ── 2. Expire trials ─────────────────────────────────────────────
  const expiredTrials = await UserModel.find({
    botState: { $in: ["trial", "trial_quota_daily_exhausted"] },
    trialEndsAt: { $lt: now },
  });

  for (const user of expiredTrials) {
    const tid = user._id.toString();

    // If the tenant's current ready package configures a fallback package,
    // auto-switch to it and apply its terms instead of expiring.
    const sub = await SubscriptionModel.findOne({ tenantId: tid });
    const currentPkg = sub?.readyPackageId
      ? await ReadyPackageModel.findById(sub.readyPackageId).lean()
      : null;
    const fallbackPkg = currentPkg?.fallbackPackageId
      ? await ReadyPackageModel.findOne({ _id: currentPkg.fallbackPackageId, isActive: true }).lean()
      : null;

    if (fallbackPkg) {
      await applyReadyPackageToTenant(tid, fallbackPkg);
      logSystemEventAsync({
        category: "bot_state", action: "bot_state_change", email: user.email,
        details: {
          previousState: user.botState, nextState: "trial", reason: "fallback_package_applied",
          fromPackageId: String(currentPkg?._id), toPackageId: String(fallbackPkg._id), toPackageName: fallbackPkg.name,
        },
      });
      result.stateTransitions++;
      continue;
    }

    await UserModel.findByIdAndUpdate(user._id, { botState: "trial_expired" });
    logSystemEventAsync({
      category: "bot_state", action: "bot_state_change", email: user.email,
      details: { previousState: user.botState, nextState: "trial_expired", reason: "trial_ended" },
    });
    // Notify tenant
    if (!(await notificationSentToday(tid, "trial_expired"))) {
      await createNotification(tid, "trial_expired",
        "ระยะเวลาทดลองใช้หมดแล้ว",
        "กรุณาเลือกแพ็กเกจเพื่อเปิดใช้งานบอทต่อ ไม่ต้องเสียใจ ข้อมูลทั้งหมดยังอยู่ครบถ้วน",
        "/pricing"
      );
    }
    result.trialExpired++;
    result.stateTransitions++;
  }

  // ── 3. Expire grace periods ──────────────────────────────────────
  const expiredGrace = await SubscriptionModel.find({
    graceDueDate: { $lt: now },
    status: { $in: ["past_due", "unpaid"] },
  });

  for (const sub of expiredGrace) {
    const prevUser = await UserModel.findOneAndUpdate(
      { _id: sub.tenantId, botState: "grace_5pct" },
      { botState: "suspended_payment" }
    );
    if (prevUser) {
      logSystemEventAsync({
        category: "bot_state", action: "bot_state_change", email: prevUser.email,
        details: { previousState: "grace_5pct", nextState: "suspended_payment", reason: "grace_period_expired" },
      });
    }
    const tid = sub.tenantId.toString();
    if (!(await notificationSentToday(tid, "payment_grace"))) {
      await createNotification(tid, "payment_grace",
        "บอทถูกระงับเนื่องจากค้างชำระ",
        "กรุณาชำระค่าบริการที่ค้างอยู่เพื่อกลับมาใช้งาน",
        "/dashboard/billing"
      );
    }
    result.graceExpired++;
    result.stateTransitions++;
  }

  // ── 4. Re-evaluate active subscriptions ─────────────────────────
  const activeUsers = await UserModel.find({
    botState: { $in: ["active", "grace_5pct"] },
    role: "tenant",
  });

  for (const user of activeUsers) {
    const sub     = await SubscriptionModel.findOne({ tenantId: user._id.toString() });
    const profile = await TenantProfileModel.findOne({ tenantId: user._id.toString() });
    if (!sub || !profile) continue;

    const planId = (sub.planId as PlanId) || "starter";
    const ctx: BotStateContext = {
      current:            user.botState as BotState,
      trialEndsAt:        user.trialEndsAt,
      dailyMsgCount:      profile.dailyMessageCount,
      dailyQuotaCap:      dailyCapForPlan(planId),
      quotaGraceBuffer:   DEFAULT_PM_CONFIG.quotaGraceBufferPercent / 100,
      subscriptionStatus: sub.status as BotStateContext["subscriptionStatus"],
      graceDueDate:       sub.graceDueDate,
      now,
    };

    const { nextState, reason } = evaluateBotState(ctx);
    if (nextState !== user.botState && reason !== "no_change") {
      await UserModel.findByIdAndUpdate(user._id, { botState: nextState });
      logSystemEventAsync({
        category: "bot_state", action: "bot_state_change", email: user.email,
        details: { previousState: user.botState, nextState, reason },
      });
      result.stateTransitions++;
    }
  }

  // ── 5. Clean up expired conversation sessions ───────────────────
  result.sessionsCleared = await cleanupExpiredSessions();

  // ── 6. Retention warning notifications ──────────────────────────
  const warnDays = cfg.retentionWarningDays;
  const expiringTenants = await getTenantsWithExpiringData(warnDays);

  for (const tenantId of expiringTenants) {
    if (!(await notificationSentToday(tenantId, "retention_warning"))) {
      await createNotification(tenantId, "retention_warning",
        `ข้อมูลการสนทนาจะหมดอายุใน ${warnDays} วัน`,
        "อัปเกรดแพ็กเกจ Retention เพื่อเก็บข้อมูลนานขึ้น — ข้อมูลที่หมดอายุจะถูกลบถาวร",
        "/dashboard/billing"
      );
      result.retentionWarnings++;
    }
  }

  // ── 7. Trial expiry warning (3 days before) ──────────────────────
  const trialWarnAt = new Date(now.getTime() + 3 * 86_400_000);
  const nearExpiryTrials = await UserModel.find({
    botState: { $in: ["trial", "trial_quota_daily_exhausted"] },
    trialEndsAt: { $gte: now, $lte: trialWarnAt },
  });

  for (const user of nearExpiryTrials) {
    const tid = user._id.toString();
    if (!(await notificationSentToday(tid, "trial_expiry_3days"))) {
      const daysLeft = Math.max(1, Math.ceil(
        ((user.trialEndsAt?.getTime() ?? 0) - now.getTime()) / 86_400_000
      ));
      await createNotification(tid, "trial_expiry_3days",
        `ทดลองใช้เหลืออีก ${daysLeft} วัน`,
        "เลือกแพ็กเกจตอนนี้เพื่อไม่ให้บอทหยุดทำงาน — ข้อมูลทั้งหมดจะยังคงอยู่",
        "/pricing"
      );
      result.trialWarnings++;
    }
  }

  // ── 8. PromptPay renewal reminder (3 days before expiry) ────────
  const renewWarnAt = new Date(now.getTime() + 3 * 86_400_000);
  const expiringPromptPay = await SubscriptionModel.find({
    paymentMethod: "promptpay",
    status:        "active",
    currentPeriodEnd: { $gte: now, $lte: renewWarnAt },
  });

  const BASE_URL = AMPLIFY_CONFIG.authUrl;

  for (const sub of expiringPromptPay) {
    const tid = sub.tenantId.toString();
    if (await notificationSentToday(tid, "promptpay_renewal_3days")) continue;

    const user = await UserModel.findById(tid);
    if (!user?.email) continue;

    const planId      = (sub.planId      as PlanId)           || "starter";
    const memoryId    = (sub.memoryAddonId    as MemoryAddonId)   || "free";
    const retentionId = (sub.retentionAddonId as RetentionAddonId) || "standard";

    const planLabel = [
      PLAN_CATALOG[planId]?.label,
      MEMORY_ADDON_CATALOG[memoryId]?.label,
      RETENTION_ADDON_CATALOG[retentionId]?.label,
    ].filter(Boolean).join(" + ");

    const daysLeft = Math.max(1, Math.ceil(
      ((sub.currentPeriodEnd?.getTime() ?? 0) - now.getTime()) / 86_400_000
    ));

    const renewUrl = `${BASE_URL}/checkout?plan=${planId}&memory=${memoryId}&retention=${retentionId}`;

    // In-app notification
    await createNotification(
      tid,
      "promptpay_renewal_3days",
      `แพ็กเกจจะหมดอายุใน ${daysLeft} วัน`,
      "กรุณาชำระ PromptPay ใหม่เพื่อให้บอทของคุณทำงานต่อเนื่อง",
      renewUrl,
    );

    // Email
    try {
      await sendEmail(
        user.email,
        `แพ็กเกจ Zudobot ของคุณจะหมดอายุใน ${daysLeft} วัน`,
        promptPayRenewalHtml({
          name:      user.name ?? "ลูกค้า",
          planLabel,
          totalThb:  sub.totalThb,
          expiresAt: sub.currentPeriodEnd ?? new Date(),
          daysLeft,
          renewUrl,
        }),
      );
    } catch (emailErr) {
      console.error("[daily-check] promptpay email failed:", tid, emailErr);
    }

    result.promptPayReminders++;
  }

  // ── Hard-delete partners soft-deleted > 90 days ago ───────────────
  const cutoff90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const expiredPartners = await PartnerProfileModel
    .find({ deletedAt: { $lte: cutoff90 } })
    .select("_id userId")
    .lean();

  if (expiredPartners.length > 0) {
    const partnerIds  = expiredPartners.map((p) => p._id);
    const userIds     = expiredPartners.map((p) => p.userId).filter(Boolean);
    await Promise.all([
      PartnerProfileModel.deleteMany({ _id: { $in: partnerIds } }),
      UserModel.deleteMany({ _id: { $in: userIds } }),
      SubscriptionModel.updateMany(
        { referredByPartnerId: { $in: partnerIds.map(String) } },
        { $unset: { referredByPartnerId: "", partnerStripeAccountId: "" } }
      ),
    ]);
    result.partnersHardDeleted = expiredPartners.length;
  }

  return result;
}
