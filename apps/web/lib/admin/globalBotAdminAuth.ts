import { NextRequest } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { verifyTotp } from "@/lib/auth/totp";
import {
  requireAdminTotpSecret,
  requireMongoUri,
} from "@/lib/platform/platformGlobalBotEnv";

export function assertAdminRole(role?: string): void {
  if (role !== "admin" && role !== "super_admin") {
    throw new Error("forbidden");
  }
}

export async function requireAdminSession(req: NextRequest): Promise<void> {
  requireMongoUri();
  const token = await getServerToken(req);
  assertAdminRole(token?.role as string | undefined);
}

export async function verifyAdminStepUpToken(secureToken: string): Promise<boolean> {
  requireMongoUri();
  const secret = requireAdminTotpSecret();
  const cleaned = secureToken.trim();
  if (cleaned.length !== 6) return false;
  return verifyTotp(secret, cleaned);
}
