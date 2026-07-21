/**
 * POST /api/admin/delete-account
 * Body: { email: string, confirm?: boolean }
 *
 * ลบข้อมูลทั้งหมดของ user ออกจากระบบ ไม่ว่าจะเป็น role อะไร
 *
 * - confirm: false (default) → dry-run แสดงสิ่งที่จะถูกลบ
 * - confirm: true            → ลบจริง
 *
 * Protected: super_admin เท่านั้น
 * Protected: ไม่สามารถลบบัญชีของตัวเองได้
 */

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { getServerToken } from "@/lib/auth/getServerToken";
import { connectDB } from "@/lib/db/connect";
import { UserModel } from "@/lib/db/models/User";
import { TenantProfileModel } from "@/lib/db/models/TenantProfile";
import { SubscriptionModel } from "@/lib/db/models/Subscription";
import { ConversationSessionModel } from "@/lib/db/models/ConversationSession";
import { KnowledgeChunkModel } from "@/lib/db/models/KnowledgeChunk";
import { KnowledgeJobModel } from "@/lib/db/models/KnowledgeJob";
import { ProductModel } from "@/lib/db/models/Product";
import { NotificationModel } from "@/lib/db/models/Notification";
import { InvoiceModel } from "@/lib/db/models/Invoice";
import { KycSubmissionModel } from "@/lib/db/models/KycSubmission";
import { VipTenantModel } from "@/lib/db/models/VipTenant";
import { PartnerProfileModel } from "@/lib/db/models/PartnerProfile";
import { PartnerLegalProfileModel } from "@/lib/db/models/PartnerLegalProfile";
import { PartnerInvoiceModel } from "@/lib/db/models/PartnerInvoice";
import { PartnerClientDataModel } from "@/lib/db/models/PartnerClientData";
import { CustomerMemoryModel } from "@/lib/db/models/CustomerMemory";
import { RagEventLogModel } from "@/lib/db/models/RagEventLog";
import { ZudobotConfig as ZudobotConfigModel } from "@/lib/db/models/ZudobotConfig";
import { ChatSessionModel } from "@/lib/db/models/ChatSession";
import { getStripe } from "@/lib/stripe/client";
import { logSystemEvent } from "@/lib/logging/systemLogger";

const PROTECTED_EMAIL = "zudogu.official@gmail.com";

async function cancelStripeSubscription(tenantId: string) {
  const sub = await SubscriptionModel.findOne({
    tenantId,
    status: { $in: ["active", "trialing", "past_due"] },
  });
  if (!sub?.stripeSubId) return;
  try {
    const stripe = getStripe();
    await stripe.subscriptions.cancel(sub.stripeSubId);
  } catch (err) {
    console.error(`[delete-account] Stripe cancel failed for ${tenantId}:`, err);
  }
}

function toOid(id: string): mongoose.Types.ObjectId | null {
  try { return new mongoose.Types.ObjectId(id); } catch { return null; }
}

function unique(arr: string[]): string[] {
  const seen = new Set<string>();
  return arr.filter((x) => { if (seen.has(x)) return false; seen.add(x); return true; });
}

export async function POST(req: NextRequest) {
  const token = await getServerToken(req);
  if (token?.role !== "super_admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: { email?: string; confirm?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const targetEmail = body.email?.trim().toLowerCase();
  if (!targetEmail) {
    return NextResponse.json({ error: "email_required" }, { status: 400 });
  }
  if (targetEmail === PROTECTED_EMAIL) {
    return NextResponse.json({ error: "cannot_delete_super_admin" }, { status: 403 });
  }
  if (targetEmail === token.email?.toLowerCase()) {
    return NextResponse.json({ error: "cannot_delete_own_account" }, { status: 403 });
  }

  const isDryRun = body.confirm !== true;

  await connectDB();

  // ── หา User ─────────────────────────────────────────────────────────────────
  const user = await UserModel.findOne({ email: targetEmail }).lean();
  if (!user) {
    return NextResponse.json({
      ok: true,
      found: false,
      message: `ไม่พบ user ที่มี email: ${targetEmail}`,
    });
  }

  const userId   = user._id.toString();
  const tenantId = user.tenantId ?? userId;
  const tenantIds = unique([userId, tenantId].filter(Boolean));
  const oids      = tenantIds.map(toOid).filter((x): x is mongoose.Types.ObjectId => x !== null);

  // ── หา PartnerProfile ────────────────────────────────────────────────────────
  const partnerProfile = await PartnerProfileModel.findOne({
    $or: [{ userId }, { email: targetEmail }],
  }).lean();
  const partnerId = partnerProfile?._id?.toString() ?? null;

  // ── Queries ──────────────────────────────────────────────────────────────────
  const tenantQ = { tenantId: { $in: tenantIds } };
  const tenantOrOidQ = oids.length > 0
    ? { $or: [{ tenantId: { $in: tenantIds } }, { tenantId: { $in: oids } }] }
    : tenantQ;
  const vipQ    = { $or: [{ email: targetEmail }, tenantQ] };
  const partnerQ = partnerId
    ? { $or: [{ partnerId }, tenantQ] } as mongoose.FilterQuery<unknown>
    : tenantQ;

  // ── นับ documents ──────────────────────────────────────────────────────────
  const [
    tenantProfileCount,
    subscriptionCount,
    invoiceCount,
    kycCount,
    notificationCount,
    conversationCount,
    chunkCount,
    jobCount,
    chatCount,
    productCount,
    zudobotConfigCount,
    memoryCount,
    ragLogCount,
    vipCount,
    partnerInvoiceCount,
    partnerLegalCount,
    partnerClientCount,
  ] = await Promise.all([
    TenantProfileModel.countDocuments(tenantQ),
    SubscriptionModel.countDocuments(tenantQ),
    InvoiceModel.countDocuments(tenantQ),
    KycSubmissionModel.countDocuments(tenantQ),
    NotificationModel.countDocuments(tenantQ),
    ConversationSessionModel.countDocuments(tenantQ),
    KnowledgeChunkModel.countDocuments(tenantQ),
    KnowledgeJobModel.countDocuments(tenantQ),
    ChatSessionModel.countDocuments(tenantOrOidQ),
    ProductModel.countDocuments(tenantQ),
    ZudobotConfigModel.countDocuments(tenantQ),
    CustomerMemoryModel.countDocuments(tenantQ),
    RagEventLogModel.countDocuments(tenantQ),
    VipTenantModel.countDocuments(vipQ),
    partnerId ? PartnerInvoiceModel.countDocuments({ partnerId }) : Promise.resolve(0),
    partnerId ? PartnerLegalProfileModel.countDocuments({ partnerId }) : Promise.resolve(0),
    partnerId ? PartnerClientDataModel.countDocuments(partnerQ) : Promise.resolve(0),
  ]);

  const counts = {
    users:                1,
    tenantprofiles:       tenantProfileCount,
    subscriptions:        subscriptionCount,
    invoices:             invoiceCount,
    kycsubmissions:       kycCount,
    notifications:        notificationCount,
    conversationsessions: conversationCount,
    knowledgechunks:      chunkCount,
    knowledgejobs:        jobCount,
    chatsessions:         chatCount,
    products:             productCount,
    zudobotconfigs:       zudobotConfigCount,
    customermemories:     memoryCount,
    rageventlogs:         ragLogCount,
    viptenants:           vipCount,
    partnerinvoices:      partnerInvoiceCount,
    partnerlegalprofiles: partnerLegalCount,
    partnerclientdatas:   partnerClientCount,
    partnerprofiles:      partnerProfile ? 1 : 0,
  };

  const summary = {
    targetEmail,
    userId,
    role:      user.role,
    tenantId,
    partnerId,
    dryRun:    isDryRun,
    counts,
    totalDocs: Object.values(counts).reduce((a, b) => a + b, 0),
  };

  if (isDryRun) {
    return NextResponse.json({ ok: true, ...summary });
  }

  // ── LIVE DELETE ──────────────────────────────────────────────────────────────
  await cancelStripeSubscription(tenantId);

  if (partnerId) {
    await Promise.all([
      PartnerInvoiceModel.deleteMany({ partnerId }),
      PartnerLegalProfileModel.deleteMany({ partnerId }),
      PartnerClientDataModel.deleteMany(partnerQ),
    ]);
    await PartnerProfileModel.deleteOne({ _id: partnerId });
  }

  await Promise.all([
    TenantProfileModel.deleteMany(tenantQ),
    SubscriptionModel.deleteMany(tenantQ),
    InvoiceModel.deleteMany(tenantQ),
    KycSubmissionModel.deleteMany(tenantQ),
    NotificationModel.deleteMany(tenantQ),
    ConversationSessionModel.deleteMany(tenantQ),
    KnowledgeChunkModel.deleteMany(tenantQ),
    KnowledgeJobModel.deleteMany(tenantQ),
    ChatSessionModel.deleteMany(tenantOrOidQ),
    ProductModel.deleteMany(tenantQ),
    ZudobotConfigModel.deleteMany(tenantQ),
    CustomerMemoryModel.deleteMany(tenantQ),
    RagEventLogModel.deleteMany(tenantQ),
    VipTenantModel.deleteMany(vipQ),
  ]);

  await UserModel.deleteOne({ email: targetEmail });

  console.log(`[admin/delete-account] Deleted: ${targetEmail} (${userId}) role=${user.role}`);
  await logSystemEvent({
    category: "admin_action", action: "hard_delete", email: targetEmail,
    actorEmail: token.email?.toLowerCase(),
    details: { targetType: "full_account", role: user.role, totalDocs: summary.totalDocs },
  });

  return NextResponse.json({ ok: true, deleted: true, ...summary, dryRun: false });
}
