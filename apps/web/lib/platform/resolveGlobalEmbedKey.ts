import { connectDB } from "@/lib/db/connect";
import { PlatformGlobalBotConfigModel } from "@/lib/db/models/PlatformGlobalBotConfig";

/** Singleton key used when Amplify env is not yet set; stored in MongoDB on first admin load. */
export const BOOTSTRAP_GLOBAL_EMBED_KEY = "zudobot_global_core_secure_key";

/**
 * Read embed key from Amplify runtime (new name, then legacy PLATFORM_BOT_EMBED_KEY).
 */
export function readGlobalEmbedKeyFromEnv(): string | null {
  const value =
    process.env.PLATFORM_GLOBAL_EMBED_KEY?.trim() ||
    process.env.PLATFORM_BOT_EMBED_KEY?.trim();
  return value || null;
}

/**
 * Resolve the platform global embed key without crashing the admin UI:
 * 1) Amplify env (PLATFORM_GLOBAL_EMBED_KEY or legacy PLATFORM_BOT_EMBED_KEY)
 * 2) Existing MongoDB PlatformGlobalBotConfig document
 * 3) Bootstrap singleton key (auto-persisted on first GET)
 */
export async function resolveGlobalEmbedKey(): Promise<string> {
  const fromEnv = readGlobalEmbedKeyFromEnv();
  if (fromEnv) return fromEnv;

  await connectDB();

  const existing = await PlatformGlobalBotConfigModel.findOne()
    .sort({ updatedAt: -1 })
    .select("globalEmbedKey")
    .lean();

  if (existing?.globalEmbedKey?.trim()) {
    return existing.globalEmbedKey.trim();
  }

  return BOOTSTRAP_GLOBAL_EMBED_KEY;
}
