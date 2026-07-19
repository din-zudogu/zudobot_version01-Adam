import { NextRequest, NextResponse } from "next/server";
import { getPartnerToken } from "@/lib/auth/getPartnerToken";
import { connectDB } from "@/lib/db/connect";
import { PartnerProfileModel } from "@/lib/db/models/PartnerProfile";
import { PartnerInvoiceModel } from "@/lib/db/models/PartnerInvoice";

export async function GET(req: NextRequest) {
  const token = await getPartnerToken(req);
  if (!token) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const page  = Math.max(1, parseInt(searchParams.get("page")  ?? "1",  10));
  const limit = Math.min(24, parseInt(searchParams.get("limit") ?? "12", 10));

  await connectDB();

  const partner = await PartnerProfileModel.findOne({ userId: token.sub }).lean();
  if (!partner) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const partnerId = partner._id.toString();
  const [invoices, total] = await Promise.all([
    PartnerInvoiceModel
      .find({ partnerId })
      .sort({ billingYear: -1, billingMonth: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    PartnerInvoiceModel.countDocuments({ partnerId }),
  ]);

  return NextResponse.json({ invoices, total, page, limit });
}
