import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { connectDB } from "@/lib/db/connect";
import { PartnerProfileModel, generateInviteToken, generateVerifyCode, verifyUrl } from "@/lib/db/models/PartnerProfile";
import { UserModel } from "@/lib/db/models/User";
import { sendPartnerInviteEmail } from "@/lib/email/resend";

export async function GET(req: NextRequest) {
  const token = await getServerToken(req);
  if (token?.role !== "super_admin" && token?.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const page   = Math.max(1, parseInt(searchParams.get("page")  ?? "1", 10));
  const limit  = Math.min(50, parseInt(searchParams.get("limit") ?? "20", 10));
  const search = searchParams.get("q") ?? "";
  const status = searchParams.get("status") ?? "";

  await connectDB();

  const filter: Record<string, unknown> = { deletedAt: { $exists: false } };
  if (search) {
    filter.$or = [
      { email:       { $regex: search, $options: "i" } },
      { companyName: { $regex: search, $options: "i" } },
    ];
  }
  if (status) filter.status = status;

  const total    = await PartnerProfileModel.countDocuments(filter);
  const partners = await PartnerProfileModel
    .find(filter)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .select("-inviteToken")
    .lean();

  // Include partner_admin users who have no PartnerProfile document (orphaned accounts)
  // Only fetch these on page 1 with no filters so they appear at the top
  let orphaned: unknown[] = [];
  if (page === 1 && !search && !status) {
    const partnerEmails = new Set(partners.map((p) => (p as { email?: string }).email?.toLowerCase()));
    const orphanedUsers = await UserModel.find({ role: "partner_admin" })
      .select("_id email name tenantId role createdAt")
      .lean();
    orphaned = orphanedUsers
      .filter((u) => !partnerEmails.has(u.email?.toLowerCase()))
      .map((u) => ({
        _id:               u._id.toString(),
        companyName:       u.name || u.email,
        email:             u.email,
        status:            "active",
        isStripeConnected: false,
        totalActiveSlots:  0,
        totalEarningsThb:  0,
        createdAt:         u.createdAt,
        isOrphaned:        true,
      }));
  }

  return NextResponse.json({ partners: [...orphaned, ...partners], total: total + orphaned.length, page, limit });
}

/** POST — admin invites a new partner. Body: { companyName, email, phone? } */
export async function POST(req: NextRequest) {
  const token = await getServerToken(req);
  if (token?.role !== "super_admin" && token?.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: { companyName: string; email: string; phone?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }

  const { companyName, email, phone } = body;
  if (!companyName?.trim() || !email?.trim()) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }

  await connectDB();

  const existing = await PartnerProfileModel.findOne({ inviteEmail: email.toLowerCase(), deletedAt: { $exists: false } });
  if (existing) return NextResponse.json({ error: "already_invited" }, { status: 409 });

  const inviteToken         = generateInviteToken();
  const verifyCode          = generateVerifyCode();
  const inviteExpiresAt     = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  const verifyCodeExpiresAt = inviteExpiresAt;

  const partner = await PartnerProfileModel.create({
    userId:               `pending_${inviteToken}`,  // unique placeholder — set on join
    companyName:          companyName.trim(),
    email:                email.toLowerCase(),
    phone:                phone?.trim(),
    status:               "invited",
    inviteToken,
    inviteExpiresAt,
    inviteEmail:          email.toLowerCase(),
    verifyCode,
    verifyCodeExpiresAt,
    verifyAttempts:       0,
    isStripeConnected:    false,
    totalActiveSlots:     0,
    totalEarningsThb:     0,
  });

  const partnerVerifyUrl = verifyUrl(inviteToken);

  let emailSent = false;
  try {
    await sendPartnerInviteEmail({
      to:          email.toLowerCase(),
      companyName: companyName.trim(),
      joinUrl:     partnerVerifyUrl,
      expiresAt:   inviteExpiresAt,
    });
    emailSent = true;
  } catch (err) {
    console.error("[partner-invite] email send failed:", err);
  }

  return NextResponse.json(
    { partner: { ...partner.toObject(), inviteToken: undefined, verifyCode: undefined }, verifyUrl: partnerVerifyUrl, verifyCode, emailSent },
    { status: 201 }
  );
}
