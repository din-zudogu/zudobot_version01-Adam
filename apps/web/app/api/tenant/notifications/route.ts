import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { connectDB } from "@/lib/db/connect";
import { NotificationModel } from "@/lib/db/models/Notification";

export async function GET(req: NextRequest) {
  const token = await getServerToken(req);
  if (!token?.sub || token.role !== "tenant") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const limit = Math.min(50, parseInt(new URL(req.url).searchParams.get("limit") ?? "20", 10));

  try {
    await connectDB();
    const [notifications, unreadCount] = await Promise.all([
      NotificationModel
        .find({ tenantId: token.sub })
        .sort({ createdAt: -1 })
        .limit(limit),
      NotificationModel.countDocuments({ tenantId: token.sub, isRead: false }),
    ]);
    return NextResponse.json({ notifications, unreadCount });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

// DELETE — clear all notifications for this tenant
export async function DELETE(req: NextRequest) {
  const token = await getServerToken(req);
  if (!token?.sub || token.role !== "tenant") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    await connectDB();
    await NotificationModel.deleteMany({ tenantId: token.sub });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
