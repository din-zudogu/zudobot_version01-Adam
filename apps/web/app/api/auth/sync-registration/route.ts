import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { connectDB } from "@/lib/db/connect";
import { UserModel } from "@/lib/db/models/User";

/**
 * Reports whether a pending-registration session already has a User row in MongoDB.
 * Client should call session.update() when registered=true to refresh the JWT.
 */
export async function GET(req: NextRequest) {
  const token = await getServerToken(req);
  if (!token?.sub) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const pending = !!(token as { pendingRegistration?: boolean }).pendingRegistration;
  if (!pending) {
    return NextResponse.json({
      pending: false,
      registered: true,
      role: (token as { role?: string }).role ?? null,
    });
  }

  await connectDB();
  const googleSub = (token as { googleSub?: string }).googleSub;
  const email = (token.email as string | undefined)?.toLowerCase();

  let exists = false;
  if (googleSub) {
    exists = !!(await UserModel.exists({ googleId: googleSub }));
  }
  if (!exists && email) {
    exists = !!(await UserModel.exists({ email }));
  }

  return NextResponse.json({
    pending: true,
    registered: exists,
    hint: exists ? "call_session_update" : "complete_onboarding",
  });
}
