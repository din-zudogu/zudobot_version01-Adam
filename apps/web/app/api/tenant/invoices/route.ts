import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { connectDB } from "@/lib/db/connect";
import { InvoiceModel } from "@/lib/db/models/Invoice";

export async function GET(req: NextRequest) {
  const token = await getServerToken(req);
  if (!token?.sub || token.role !== "tenant") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const page  = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = 12;

  try {
    await connectDB();
    const total    = await InvoiceModel.countDocuments({ tenantId: token.sub });
    const invoices = await InvoiceModel
      .find({ tenantId: token.sub })
      .sort({ issuedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select("-buyerAddress -buyerTaxId"); // omit sensitive fields from list

    return NextResponse.json({ invoices, total, page });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
