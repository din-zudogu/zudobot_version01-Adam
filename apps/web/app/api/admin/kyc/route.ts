import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { connectDB } from "@/lib/db/connect";
import { KycSubmissionModel } from "@/lib/db/models/KycSubmission";
import { UserModel } from "@/lib/db/models/User";

export async function GET(req: NextRequest) {
  const token = await getServerToken(req);
  if (token?.role !== "admin" && token?.role !== "super_admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "pending";
  const page   = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit  = 20;

  try {
    await connectDB();
    const filter = status === "all" ? {} : { status };
    const total  = await KycSubmissionModel.countDocuments(filter);
    const kycs   = await KycSubmissionModel
      .find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    // Enrich with tenant email
    const ids   = kycs.map((k) => k.tenantId);
    const users = await UserModel.find({ _id: { $in: ids } }).select("email name");
    const userMap = Object.fromEntries(users.map((u) => [u._id.toString(), u]));

    const enriched = kycs.map((k) => ({
      ...k.toObject(),
      tenantEmail: userMap[k.tenantId]?.email,
      tenantName:  userMap[k.tenantId]?.name,
    }));

    return NextResponse.json({ kycs: enriched, total, page });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
