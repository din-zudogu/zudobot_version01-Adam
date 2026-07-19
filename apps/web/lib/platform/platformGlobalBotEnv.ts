export function requireMongoUri(): void {
  if (!process.env.MONGO_URI?.trim()) {
    throw new Error(
      "CRITICAL SECURITY VIOLATION: MONGO_URI string is absent inside AWS Amplify system properties."
    );
  }
}

export function requireGlobalEmbedKey(): string {
  const value = process.env.PLATFORM_GLOBAL_EMBED_KEY?.trim();
  if (!value) {
    throw new Error(
      "SECURITY BLOCK: PLATFORM_GLOBAL_EMBED_KEY is missing inside AWS Amplify properties."
    );
  }
  return value;
}

export function requireAdminTotpSecret(): string {
  const value = process.env.ADMIN_TOTP_SECRET?.trim();
  if (!value) {
    throw new Error(
      "SECURITY BLOCK: ADMIN_TOTP_SECRET is missing inside AWS Amplify properties."
    );
  }
  return value;
}

export function requirePlatformGlobalChatTenantId(): string {
  const value = process.env.PLATFORM_GLOBAL_CHAT_TENANT_ID?.trim();
  if (!value) {
    throw new Error(
      "SECURITY BLOCK: PLATFORM_GLOBAL_CHAT_TENANT_ID is missing inside AWS Amplify properties."
    );
  }
  return value;
}
