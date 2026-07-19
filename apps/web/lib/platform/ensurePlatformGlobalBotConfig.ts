import { connectDB } from "@/lib/db/connect";
import { PlatformBotConfigModel } from "@/lib/db/models/PlatformBotConfig";
import {
  PlatformGlobalBotConfigModel,
  type IPlatformGlobalBotConfig,
} from "@/lib/db/models/PlatformGlobalBotConfig";
import { requireMongoUri } from "@/lib/platform/platformGlobalBotEnv";
import { resolveGlobalEmbedKey } from "@/lib/platform/resolveGlobalEmbedKey";

async function migrateLegacyPlatformBotConfig(
  globalEmbedKey: string
): Promise<IPlatformGlobalBotConfig | null> {
  const legacy = await PlatformBotConfigModel.findOne().lean();
  if (!legacy) return null;

  const migrated = await PlatformGlobalBotConfigModel.create({
    globalEmbedKey,
    botName: legacy.botName,
    welcomeMessage: legacy.welcomeMessage,
    themeColor: legacy.themeColor,
    avatarUrl: legacy.avatarUrl ?? "",
    whitelistedDomains: legacy.whitelistedDomains ?? [],
  });

  return migrated;
}

export async function ensurePlatformGlobalBotConfig(): Promise<IPlatformGlobalBotConfig> {
  requireMongoUri();
  await connectDB();

  const globalEmbedKey = await resolveGlobalEmbedKey();

  let config = await PlatformGlobalBotConfigModel.findOne({ globalEmbedKey });
  if (!config) {
    config = await PlatformGlobalBotConfigModel.findOne();
  }
  if (!config) {
    const migrated = await migrateLegacyPlatformBotConfig(globalEmbedKey);
    if (migrated) {
      config = await PlatformGlobalBotConfigModel.findById(migrated._id);
    }
  }

  if (!config) {
    config = await PlatformGlobalBotConfigModel.create({
      globalEmbedKey,
      botName: "Zudobot แอดมินหลัก",
      welcomeMessage: "สวัสดีครับ มีอะไรให้ผมช่วยเหลือไหมครับ",
      themeColor: "#3B82F6",
      avatarUrl: "",
      whitelistedDomains: [],
    });
  } else if (config.globalEmbedKey !== globalEmbedKey) {
    config.globalEmbedKey = globalEmbedKey;
    await config.save();
  }

  return config;
}
