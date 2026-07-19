/**
 * Platform core KB URLs for admin manual sync (comma-separated, Amplify only).
 * Example: https://zudobot.zudogu.com/,https://zudobot.zudogu.com/pricing,...
 */
export function getPlatformKbCoreUrlsFromEnv(): string[] {
  const raw = process.env.NEXT_PUBLIC_PLATFORM_KB_CORE_URLS;
  if (!raw?.trim()) {
    throw new Error(
      "CRITICAL: NEXT_PUBLIC_PLATFORM_KB_CORE_URLS is missing or empty in AWS Amplify environment"
    );
  }

  const urls = raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (urls.length === 0) {
    throw new Error(
      "CRITICAL: NEXT_PUBLIC_PLATFORM_KB_CORE_URLS must contain at least one URL"
    );
  }

  return urls;
}
