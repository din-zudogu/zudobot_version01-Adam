/**
 * svc_zudobot_checkpackage
 * Gatekeeper service — runs before every Gemini call.
 *
 * Checks:
 *  1. Lazy billing cycle reset (auto-renew when cycleEndDate passes)
 *  2. Message quota + 10-message grace period
 *  3. Memory quota flag (non-blocking, sets isMemoryFull)
 *
 * Returns CheckPackageResult — caller decides whether to block or continue.
 */

import mongoose from "mongoose";
import TenantUsageModel from "@/models/tenantUsage";
import type { ITenantUsage } from "@/models/tenantUsage";
import { sendHandoffAlert } from "@/services/svc_lineNotify";
import TenantModel from "@/models/tenant";

type UsageDoc = mongoose.Document & ITenantUsage;

const GRACE_PERIOD_MESSAGES = 10;

export interface CheckPackageResult {
  canChat: boolean;
  isMemoryFull: boolean;
  isInGracePeriod: boolean;
  gracePeriodRemaining: number;
  usedMessages: number;
  totalMessageQuota: number;
  usedVisitorMemory: number;
  totalVisitorMemoryQuota: number;
  blockedReason?: string;
  usage: UsageDoc;
}

export async function checkPackage(tenantId: string): Promise<CheckPackageResult> {
  const tenantOid = new mongoose.Types.ObjectId(tenantId);

  // Upsert — creates default trial usage if first chat
  let usage = await TenantUsageModel.findOneAndUpdate(
    { tenantId: tenantOid },
    { $setOnInsert: { tenantId: tenantOid } },
    { upsert: true, new: true }
  ) as UsageDoc;

  const now = new Date();

  // ── 1. Lazy cycle reset ──────────────────────────────────────────────────
  if (now > usage.cycleEndDate) {
    const newStart = usage.cycleEndDate;
    const newEnd   = new Date(newStart.getTime() + 30 * 24 * 60 * 60 * 1000);
    usage = await TenantUsageModel.findOneAndUpdate(
      { tenantId: tenantOid },
      {
        $set: {
          usedMessages:   0,
          cycleStartDate: newStart,
          cycleEndDate:   newEnd,
          lastResetAt:    now,
          isMemoryFull:   usage.usedVisitorMemory >= usage.totalVisitorMemoryQuota && usage.totalVisitorMemoryQuota > 0,
        },
      },
      { new: true }
    ) as UsageDoc;
  }

  // ── 2. Message quota check ──────────────────────────────────────────────
  const hardLimit  = usage.totalMessageQuota + GRACE_PERIOD_MESSAGES;
  const overQuota  = usage.usedMessages >= usage.totalMessageQuota;
  const overHard   = usage.usedMessages >= hardLimit;
  const inGrace    = overQuota && !overHard;
  const graceLeft  = overQuota ? Math.max(0, hardLimit - usage.usedMessages) : GRACE_PERIOD_MESSAGES;

  if (overHard) {
    // Fire non-blocking LINE alert if configured
    fireQuotaAlert(tenantId, "messages_exhausted").catch(() => {});
    return {
      canChat: false,
      isMemoryFull: usage.isMemoryFull,
      isInGracePeriod: false,
      gracePeriodRemaining: 0,
      usedMessages: usage.usedMessages,
      totalMessageQuota: usage.totalMessageQuota,
      usedVisitorMemory: usage.usedVisitorMemory,
      totalVisitorMemoryQuota: usage.totalVisitorMemoryQuota,
      blockedReason: "quota_exhausted",
      usage,
    };
  }

  if (inGrace) {
    // Alert on first grace message only (avoid spamming)
    if (usage.usedMessages === usage.totalMessageQuota) {
      fireQuotaAlert(tenantId, "messages_grace_period").catch(() => {});
    }
  }

  // ── 3. Memory quota check (non-blocking) ────────────────────────────────
  const memoryFull = usage.totalVisitorMemoryQuota > 0 &&
                     usage.usedVisitorMemory >= usage.totalVisitorMemoryQuota;

  if (memoryFull && !usage.isMemoryFull) {
    TenantUsageModel.updateOne({ tenantId: tenantOid }, { $set: { isMemoryFull: true } }).catch(() => {});
    usage.isMemoryFull = true;
    fireQuotaAlert(tenantId, "memory_full").catch(() => {});
  }

  return {
    canChat: true,
    isMemoryFull: memoryFull,
    isInGracePeriod: inGrace,
    gracePeriodRemaining: graceLeft,
    usedMessages: usage.usedMessages,
    totalMessageQuota: usage.totalMessageQuota,
    usedVisitorMemory: usage.usedVisitorMemory,
    totalVisitorMemoryQuota: usage.totalVisitorMemoryQuota,
    usage,
  };
}

/** Increment usedMessages by 1 after a successful chat turn. */
export async function incrementMessageCount(tenantId: string): Promise<void> {
  await TenantUsageModel.updateOne(
    { tenantId: new mongoose.Types.ObjectId(tenantId) },
    { $inc: { usedMessages: 1 } }
  );
}

/** Update usedVisitorMemory count (called by svc_zudobot_recognize after save/evict). */
export async function syncVisitorMemoryCount(tenantId: string, delta: number): Promise<void> {
  if (delta === 0) return;
  const oid   = new mongoose.Types.ObjectId(tenantId);
  const usage = await TenantUsageModel.findOneAndUpdate(
    { tenantId: oid },
    { $inc: { usedVisitorMemory: delta } },
    { new: true }
  );
  if (!usage) return;
  const nowFull = usage.totalVisitorMemoryQuota > 0 &&
                  usage.usedVisitorMemory >= usage.totalVisitorMemoryQuota;
  if (nowFull !== usage.isMemoryFull) {
    await TenantUsageModel.updateOne({ tenantId: oid }, { $set: { isMemoryFull: nowFull } });
  }
}

// ── Internal helpers ───────────────────────────────────────────────────────

type AlertType = "messages_exhausted" | "messages_grace_period" | "memory_full";

async function fireQuotaAlert(tenantId: string, alertType: AlertType): Promise<void> {
  const tenant = await TenantModel.findById(tenantId).lean();
  if (!tenant?.lineNotifyEnabled || !tenant?.lineNotifyToken) return;

  const messages: Record<AlertType, string> = {
    messages_exhausted:    `⚠️ Zudobot — โควต้าข้อความหมดแล้ว\nร้าน: ${tenant.name}\nบอทจะหยุดตอบจนกว่าจะอัปเกรดแพ็กเกจ`,
    messages_grace_period: `🔔 Zudobot — โควต้าข้อความใกล้หมด\nร้าน: ${tenant.name}\nกำลังใช้งาน Grace Period (เหลืออีก ${GRACE_PERIOD_MESSAGES} ข้อความ) กรุณาอัปเกรดโดยเร็ว`,
    memory_full:           `🧠 Zudobot — พื้นที่ความจำลูกค้าเต็มแล้ว\nร้าน: ${tenant.name}\nบอทจะเริ่มลืมลูกค้ารายเก่า กรุณาซื้อ Addon Memory เพื่อรักษาความจำ`,
  };

  await sendHandoffAlert(tenant.lineNotifyToken, {
    shopName:    tenant.name,
    sessionId:   alertType,
    visitorId:   null,
    lastMessage: messages[alertType],
  });
}
