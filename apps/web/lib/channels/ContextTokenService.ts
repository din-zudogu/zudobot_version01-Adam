import { connectDB } from "@/lib/db/connect";
import { ChannelContextTokenModel } from "@/lib/db/models/ChannelContextToken";
import type { PlatformName } from "./IChannelAdapter";

const TTL_MS = 15 * 60 * 1000; // 15 minutes

export interface ContextTokenPayload {
  tenantId:       string;
  embedKey:       string;
  platformUserId: string;
  platformName:   PlatformName;
  initialMessage: string;
  displayName?:   string;
}

export async function createContextToken(payload: ContextTokenPayload): Promise<string> {
  await connectDB();
  const token = crypto.randomUUID();
  await ChannelContextTokenModel.create({
    token,
    ...payload,
    expiresAt: new Date(Date.now() + TTL_MS),
  });
  return token;
}

/** Resolves and immediately deletes the token (single-use). Returns null if expired or not found. */
export async function resolveContextToken(token: string): Promise<ContextTokenPayload | null> {
  await connectDB();
  const doc = await ChannelContextTokenModel.findOneAndDelete({
    token,
    expiresAt: { $gt: new Date() },
  });
  if (!doc) return null;
  return {
    tenantId:       doc.tenantId,
    embedKey:       doc.embedKey,
    platformUserId: doc.platformUserId,
    platformName:   doc.platformName,
    initialMessage: doc.initialMessage,
    displayName:    doc.displayName,
  };
}
