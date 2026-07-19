/**
 * Public app base URL from Amplify (client-safe NEXT_PUBLIC_*).
 */
export function requirePublicAppUrl(): string {
  const value = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!value) {
    throw new Error(
      "CRITICAL: NEXT_PUBLIC_APP_URL is missing or empty in AWS Amplify environment"
    );
  }
  return value.replace(/\/$/, "");
}
