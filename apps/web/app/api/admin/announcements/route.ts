import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { connectDB } from "@/lib/db/connect";
import { UserModel } from "@/lib/db/models/User";
import { AnnouncementModel } from "@/lib/db/models/Announcement";
import { createNotification } from "@/lib/notifications/notificationService";

export async function GET(req: NextRequest) {
  const token = await getServerToken(req);
  if (token?.role !== "super_admin" && token?.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    await connectDB();
    const announcements = await AnnouncementModel
      .find()
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
    return NextResponse.json({ announcements });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "server_error";
    console.error("[admin/announcements GET]", msg);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const token = await getServerToken(req);
  if (token?.role !== "super_admin" && token?.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const title     = body.title?.trim();
  const message   = body.message?.trim();
  const actionUrl = body.actionUrl?.trim() || undefined;

  if (!title || !message) {
    return NextResponse.json({ error: "title and message required" }, { status: 400 });
  }

  try {
    await connectDB();

    const tenants = await UserModel.find({ role: "tenant" }).select("_id").lean();

    const announcement = await AnnouncementModel.create({
      title,
      message,
      actionUrl,
      createdBy:      token.sub ?? "admin",
      recipientCount: tenants.length,
    });

    // Send in chunks to avoid overwhelming the DB
    const CHUNK = 100;
    for (let i = 0; i < tenants.length; i += CHUNK) {
      await Promise.all(
        tenants.slice(i, i + CHUNK).map((t) =>
          createNotification(
            t._id.toString(),
            "system_announcement",
            title,
            message,
            actionUrl
          )
        )
      );
    }

    return NextResponse.json({
      ok:             true,
      id:             announcement._id,
      recipientCount: tenants.length,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "server_error";
    console.error("[admin/announcements POST]", msg);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
