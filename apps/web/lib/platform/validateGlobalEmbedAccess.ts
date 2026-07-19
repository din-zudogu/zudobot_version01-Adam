import { connectDB } from "@/lib/db/connect";
import {
  PlatformGlobalBotConfigModel,
  type IPlatformGlobalBotConfig,
} from "@/lib/db/models/PlatformGlobalBotConfig";
import { requireMongoUri } from "@/lib/platform/platformGlobalBotEnv";
import {
  buildCorsAllowOrigin,
  isDomainExplicitlyWhitelisted,
  resolveRequestDomain,
} from "@/lib/security/secureOrigin";

export type GlobalEmbedAccessResult =
  | {
      ok: true;
      config: IPlatformGlobalBotConfig;
      resolvedDomain: string;
      corsOrigin: string;
    }
  | {
      ok: false;
      status: number;
      error: string;
    };

export async function validateGlobalEmbedAccess(
  embedKey: string | null,
  originHeader: string | null,
  refererHeader: string | null
): Promise<GlobalEmbedAccessResult> {
  requireMongoUri();

  if (!embedKey?.trim()) {
    return {
      ok: false,
      status: 400,
      error: "Access Denied: Missing verification token",
    };
  }

  const resolvedDomain = resolveRequestDomain(originHeader, refererHeader);
  if (!resolvedDomain) {
    return {
      ok: false,
      status: 403,
      error: "Security Guard Error: Unable to trace external host identity.",
    };
  }

  await connectDB();
  const config = await PlatformGlobalBotConfigModel.findOne({
    globalEmbedKey: embedKey.trim(),
  });

  if (!config) {
    return {
      ok: false,
      status: 401,
      error: "Configuration matching failure.",
    };
  }

  const isHostAuthorized = isDomainExplicitlyWhitelisted(
    resolvedDomain,
    config.whitelistedDomains
  );

  if (!isHostAuthorized) {
    return {
      ok: false,
      status: 403,
      error: `Security Access Denied: The domain [${resolvedDomain}] is completely unauthorized to embed this Zudobot instance.`,
    };
  }

  const corsOrigin = buildCorsAllowOrigin(
    originHeader,
    refererHeader,
    resolvedDomain
  );

  if (!corsOrigin) {
    return {
      ok: false,
      status: 403,
      error: "Security Alert: CORS origin could not be validated for whitelisted domain.",
    };
  }

  return { ok: true, config, resolvedDomain, corsOrigin };
}
