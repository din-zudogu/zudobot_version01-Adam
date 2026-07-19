import { connectDB } from "@/lib/db/connect";
import { UserModel } from "@/lib/db/models/User";

export interface PendingRegistrationToken {
  pendingRegistration?: boolean;
  googleSub?: string;
  email?: string | null;
  sub?: string;
  tenantId?: string;
  role?: string;
  roles?: string[];
  onboardingComplete?: boolean;
  pendingDeleteAt?: string;
  deletedByAdmin?: boolean;
}

type DbUser = {
  _id: { toString(): string };
  onboardingComplete?: boolean;
  role?: string;
  roles?: string[];
  tenantId?: string;
  pendingDeleteAt?: Date;
  deletedByAdmin?: boolean;
};

/**
 * If JWT is still "pending" but a User row exists (onboarding finished earlier),
 * promote the token to the real MongoDB user. Returns true when resolved.
 */
export async function resolvePendingRegistrationToken(
  t: PendingRegistrationToken
): Promise<boolean> {
  if (!t.pendingRegistration) return false;

  await connectDB();

  const email = typeof t.email === "string" ? t.email.toLowerCase() : undefined;
  let dbUser: DbUser | null = null;

  if (t.googleSub) {
    dbUser = (await UserModel.findOne({ googleId: t.googleSub }).lean()) as DbUser | null;
  }
  if (!dbUser && email) {
    dbUser = (await UserModel.findOne({ email }).lean()) as DbUser | null;
  }

  if (!dbUser) return false;

  t.sub                 = dbUser._id.toString();
  t.tenantId            = (dbUser.tenantId as string | undefined) ?? dbUser._id.toString();
  t.onboardingComplete  = dbUser.onboardingComplete;
  t.role                = dbUser.role;
  t.roles               = (dbUser.roles as string[] | undefined)?.length
    ? (dbUser.roles as string[])
    : dbUser.role
      ? [dbUser.role]
      : [];
  t.pendingRegistration = false;
  t.googleSub           = undefined;
  t.pendingDeleteAt     = dbUser.pendingDeleteAt?.toISOString();
  t.deletedByAdmin      = dbUser.deletedByAdmin ?? false;

  return true;
}
