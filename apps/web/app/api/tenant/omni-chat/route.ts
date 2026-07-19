/**
 * /api/tenant/omni-chat
 * Tenant-scoped omni-chat data.
 *
 * GET ?tab=activity  — active ChannelContextTokens for this tenant
 */

import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { connectDB } from "@/lib/db/connect";
import { ChannelContextTokenModel } from "@/lib/db/models/ChannelContextToken";

export async function GET(req: NextRequest) {
  const token = await getServerToken(req);
  if (!token?.sub || token.role !== "tenant") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const tenantId = token.sub;
  const { searchParams } = new URL(req.url);
  const page  = Math.max(1, parseInt(searchParams.get("page")  ?? "1",  10));
  const limit = Math.min(50, parseInt(searchParams.get("limit") ?? "20", 10));

  await connectDB();

  const filter = { tenantId, expiresAt: { $gt: new Date() } };
  const total  = await ChannelContextTokenModel.countDocuments(filter);
  const tokens = await ChannelContextTokenModel
    .find(filter)
    .sort({ expiresAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .select("platformName displayName initialMessage expiresAt")
    .lean();

  return NextResponse.json({
    total, page, limit,
    rows: tokens.map((t) => ({
      platformName:   t.platformName,
      displayName:    t.displayName ?? "",
      initialMessage: t.initialMessage,
      expiresAt:      t.expiresAt,
    })),
  });
}
