import { NextRequest, NextResponse } from "next/server";
import { getPartnerToken } from "@/lib/auth/getPartnerToken";
import { connectDB } from "@/lib/db/connect";
import { PartnerProfileModel } from "@/lib/db/models/PartnerProfile";

export async function GET(req: NextRequest) {
  const token = await getPartnerToken(req);
  if (!token) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  await connectDB();
  const partner = await PartnerProfileModel
    .findOne({ userId: token.sub, deletedAt: { $exists: false } })
    .select("-inviteToken -inviteExpiresAt")
    .lean();

  if (!partner) return NextResponse.json({ error: "partner_deleted" }, { status: 403 });
  return NextResponse.json({ partner });
}

export async function PATCH(req: NextRequest) {
  const token = await getPartnerToken(req);
  if (!token) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: { companyName?: string; phone?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  const updates: Record<string, string> = {};
  if (body.companyName?.trim()) updates.companyName = body.companyName.trim();
  if (body.phone?.trim())       updates.phone       = body.phone.trim();

  if (!Object.keys(updates).length) {
    return NextResponse.json({ error: "nothing_to_update" }, { status: 400 });
  }

  await connectDB();
  const partner = await PartnerProfileModel.findOneAndUpdate(
    { userId: token.sub, deletedAt: { $exists: false } },
    { $set: updates },
    { new: true }
  ).select("-inviteToken -inviteExpiresAt").lean();

  if (!partner) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ partner });
}
