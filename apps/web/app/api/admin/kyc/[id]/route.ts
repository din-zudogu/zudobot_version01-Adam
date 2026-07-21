import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { connectDB } from "@/lib/db/connect";
import { KycSubmissionModel } from "@/lib/db/models/KycSubmission";
import { UserModel } from "@/lib/db/models/User";
import type { KycStatus } from "@/lib/db/models/KycSubmission";
import { logSystemEvent } from "@/lib/logging/systemLogger";

// PUT — approve / reject / request more info
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const token = await getServerToken(req);
  if (token?.role !== "admin" && token?.role !== "super_admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: { status: KycStatus; reviewNote?: string; whtExempt?: boolean; whtRate?: number };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const validStatuses: KycStatus[] = ["approved","rejected","more_info_needed"];
  if (!validStatuses.includes(body.status)) {
    return NextResponse.json({ error: "invalid_status" }, { status: 400 });
  }

  try {
    await connectDB();
    const kyc = await KycSubmissionModel.findByIdAndUpdate(
      params.id,
      {
        status:     body.status,
        reviewNote: body.reviewNote ?? "",
        reviewedBy: token.sub,
        reviewedAt: new Date(),
        ...(body.whtExempt !== undefined ? { whtExempt: body.whtExempt } : {}),
        ...(body.whtRate   !== undefined ? { whtRate:   body.whtRate   } : {}),
      },
      { new: true }
    );
    if (!kyc) return NextResponse.json({ error: "not_found" }, { status: 404 });

    // On approval: update user botState from pending_kyc → trial or active
    if (body.status === "approved") {
      const user = await UserModel.findById(kyc.tenantId);
      if (user?.botState === "pending_kyc") {
        await UserModel.findByIdAndUpdate(kyc.tenantId, { botState: "trial" });
        await logSystemEvent({
          category: "admin_action", action: "kyc_approved", email: user.email,
          actorEmail: (token.email as string | undefined)?.toLowerCase(),
          details: { targetType: "tenant", botStateChange: { from: "pending_kyc", to: "trial" } },
        });
      }
    } else {
      const user = await UserModel.findById(kyc.tenantId).select("email").lean() as { email?: string } | null;
      await logSystemEvent({
        category: "admin_action", action: `kyc_${body.status}`, email: user?.email,
        actorEmail: (token.email as string | undefined)?.toLowerCase(),
        details: { targetType: "tenant" },
      });
    }

    return NextResponse.json({ ok: true, kyc });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
