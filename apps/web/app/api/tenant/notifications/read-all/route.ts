import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { connectDB } from "@/lib/db/connect";
import { NotificationModel } from "@/lib/db/models/Notification";

export async function PUT(req: NextRequest) {
  const token = await getServerToken(req);
  if (!token?.sub || token.role !== "tenant") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    await connectDB();
    await NotificationModel.updateMany(
      { tenantId: token.sub, isRead: false },
      { $set: { isRead: true } }
    );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
