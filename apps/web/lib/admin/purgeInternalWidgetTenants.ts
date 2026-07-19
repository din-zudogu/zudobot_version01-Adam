import mongoose from "mongoose";
import { connectDB } from "@/lib/db/connect";
import { ConversationSessionModel } from "@/lib/db/models/ConversationSession";
import { InvoiceModel } from "@/lib/db/models/Invoice";
import { KnowledgeChunkModel } from "@/lib/db/models/KnowledgeChunk";
import { KnowledgeJobModel } from "@/lib/db/models/KnowledgeJob";
import { NotificationModel } from "@/lib/db/models/Notification";
import { PlatformBotConfigModel } from "@/lib/db/models/PlatformBotConfig";
import { PlatformGlobalBotConfigModel } from "@/lib/db/models/PlatformGlobalBotConfig";
import { ProductModel } from "@/lib/db/models/Product";
import { SubscriptionModel } from "@/lib/db/models/Subscription";
import { TenantProfileModel } from "@/lib/db/models/TenantProfile";
import { UserModel } from "@/lib/db/models/User";
import { SITE_WIDGET_DEFAULT_EMBED_KEY } from "@/components/widget/siteWidgetConfig";
import { BOOTSTRAP_GLOBAL_EMBED_KEY } from "@/lib/platform/resolveGlobalEmbedKey";

const INTERNAL_BUSINESS_MARKERS = [
  "zudo guide (internal)",
  "mock universal embed",
  "ร้านทดสอบ universal embed (mock)",
  "zudobot platform global embed (internal)",
];

function collectWidgetEmbedKeys(): string[] {
  const keys = [
    process.env.NEXT_PUBLIC_ZUDOBOT_SITE_EMBED_KEY?.trim(),
    process.env.NEXT_PUBLIC_ZUDOBOT_WIDGET_EMBED_KEY?.trim(),
    process.env.ZUDO_GUIDE_EMBED_KEY?.trim(),
    SITE_WIDGET_DEFAULT_EMBED_KEY,
    BOOTSTRAP_GLOBAL_EMBED_KEY,
  ];
  return Array.from(new Set(keys.filter((key): key is string => Boolean(key))));
}

export type PurgeInternalWidgetsResult = {
  dryRun: boolean;
  tenantIds: string[];
  userIds: string[];
  emails: string[];
  platformConfigsRemoved: number;
  deleted: {
    users: number;
    tenantProfiles: number;
    subscriptions: number;
    conversationSessions: number;
    knowledgeChunks: number;
    knowledgeJobs: number;
    products: number;
    notifications: number;
    invoices: number;
    platformGlobalBotConfigs: number;
    platformBotConfigs: number;
  };
};

export async function purgeInternalWidgetTenants(
  dryRun: boolean
): Promise<PurgeInternalWidgetsResult> {
  if (!process.env.MONGO_URI?.trim()) {
    throw new Error("MONGO_URI is missing");
  }

  await connectDB();

  const embedKeys = collectWidgetEmbedKeys();
  const internalTenantIds = await UserModel.find({ email: { $regex: /@zudobot\.internal$/i } })
    .distinct("tenantId");

  const profilesByKey =
    embedKeys.length > 0 && internalTenantIds.length > 0
      ? await TenantProfileModel.find({
          embedKey: { $in: embedKeys },
          tenantId: { $in: internalTenantIds },
        })
          .select("tenantId businessName embedKey")
          .lean()
      : [];

  const profilesByMarker = await TenantProfileModel.find({
    $or: INTERNAL_BUSINESS_MARKERS.map((marker) => ({
      businessName: { $regex: marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" },
    })),
  })
    .select("tenantId businessName embedKey")
    .lean();

  const internalUsers = await UserModel.find({
    email: { $regex: /@zudobot\.internal$/i },
  })
    .select("_id email tenantId")
    .lean();

  const tenantIdSet = new Set<string>();
  for (const profile of [...profilesByKey, ...profilesByMarker]) {
    if (profile.tenantId) tenantIdSet.add(profile.tenantId);
  }
  for (const user of internalUsers) {
    tenantIdSet.add(user.tenantId ?? user._id.toString());
  }

  const tenantIds = Array.from(tenantIdSet);
  const userIds = internalUsers.map((user) => user._id.toString());
  for (const tenantId of tenantIds) {
    const linked = await UserModel.findOne({
      $or: [{ tenantId }, { _id: tenantId }],
    })
      .select("_id email")
      .lean();
    if (linked) userIds.push(linked._id.toString());
  }

  const uniqueUserIds = Array.from(new Set(userIds));
  const emails = internalUsers.map((user) => user.email);

  const tenantQuery = tenantIds.length > 0 ? { tenantId: { $in: tenantIds } } : { _id: null };
  const userObjectIds = uniqueUserIds
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  const userOr: Record<string, unknown>[] = [
    { email: { $regex: /@zudobot\.internal$/i } },
  ];
  if (userObjectIds.length > 0) userOr.push({ _id: { $in: userObjectIds } });
  if (tenantIds.length > 0) userOr.push({ tenantId: { $in: tenantIds } });
  const userQuery = { $or: userOr };

  const counts = {
    users: await UserModel.countDocuments(userQuery),
    tenantProfiles: await TenantProfileModel.countDocuments(tenantQuery),
    subscriptions: await SubscriptionModel.countDocuments(tenantQuery),
    conversationSessions: await ConversationSessionModel.countDocuments(tenantQuery),
    knowledgeChunks: await KnowledgeChunkModel.countDocuments(tenantQuery),
    knowledgeJobs: await KnowledgeJobModel.countDocuments(tenantQuery),
    products: await ProductModel.countDocuments(tenantQuery),
    notifications: await NotificationModel.countDocuments(tenantQuery),
    invoices: await InvoiceModel.countDocuments(tenantQuery),
    platformGlobalBotConfigs: await PlatformGlobalBotConfigModel.countDocuments({}),
    platformBotConfigs: await PlatformBotConfigModel.countDocuments({}),
  };

  const result: PurgeInternalWidgetsResult = {
    dryRun,
    tenantIds,
    userIds: uniqueUserIds,
    emails,
    platformConfigsRemoved:
      counts.platformGlobalBotConfigs + counts.platformBotConfigs,
    deleted: { ...counts },
  };

  if (dryRun) return result;

  await Promise.all([
    UserModel.deleteMany(userQuery),
    TenantProfileModel.deleteMany(tenantQuery),
    SubscriptionModel.deleteMany(tenantQuery),
    ConversationSessionModel.deleteMany(tenantQuery),
    KnowledgeChunkModel.deleteMany(tenantQuery),
    KnowledgeJobModel.deleteMany(tenantQuery),
    ProductModel.deleteMany(tenantQuery),
    NotificationModel.deleteMany(tenantQuery),
    InvoiceModel.deleteMany(tenantQuery),
    PlatformGlobalBotConfigModel.deleteMany({}),
    PlatformBotConfigModel.deleteMany({}),
  ]);

  return result;
}
