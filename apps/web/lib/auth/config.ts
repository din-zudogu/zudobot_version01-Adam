import type { NextAuthConfig, Session } from "next-auth";
import type { JWT } from "next-auth/jwt";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db/connect";
import { AMPLIFY_CONFIG, validateAmplifyEnvironment } from "@/lib/env/amplifyGuardrail";
import { UserModel } from "@/lib/db/models/User";
import { resolvePendingRegistrationToken } from "@/lib/auth/resolvePendingRegistration";
import { logSystemEvent } from "@/lib/logging/systemLogger";

interface ImpersonatingData {
  originalTenantId: string;
  originalRole:     string;
  clientName:       string;
  partnerId:        string;
  expiresAt:        number; // Unix timestamp
}

interface ZudobotJWT extends JWT {
  role?: string;
  roles?: string[];
  tenantId?: string;
  onboardingComplete?: boolean;
  twoFaPending?: boolean;
  pendingRegistration?: boolean; // true = User doc not yet created in DB (C path)
  googleSub?: string;            // Google providerAccountId stored while pending
  pendingDeleteAt?: string;      // ISO string — account queued for hard-delete
  deletedByAdmin?:  boolean;     // true = admin-initiated; tenant cannot self-recover
  impersonating?:   ImpersonatingData;
}

interface ZudobotSession extends Session {
  user: Session["user"] & {
    id?: string;
    role?: string;
    roles?: string[];
    tenantId?: string;
    onboardingComplete?: boolean;
    pendingDeleteAt?: string;
    deletedByAdmin?:  boolean;
    impersonating?:   Omit<ImpersonatingData, "originalRole">;
  };
}

type GoogleUser = typeof import("next-auth").default extends never
  ? never
  : { id?: string; role?: string; roles?: string[]; tenantId?: string; onboardingComplete?: boolean; pendingRegistration?: boolean; pendingDeleteAt?: string; deletedByAdmin?: boolean };

validateAmplifyEnvironment();

const providers: NextAuthConfig["providers"] = [
  GoogleProvider({
    clientId:     AMPLIFY_CONFIG.googleClientId,
    clientSecret: AMPLIFY_CONFIG.googleClientSecret,
    authorization: {
      params: {
        // บังคับให้ Google แสดงหน้าเลือก account ทุกครั้ง
        // ป้องกัน auto-select หลังจาก cancel onboarding
        prompt: "select_account",
      },
    },
  }),
  // Secondary auth path — a password only ever exists for an account that
  // already went through Google-first onboarding (established via the
  // forgot-password flow). This provider never creates new accounts: an
  // unknown email or an account with no passwordHash is a hard reject.
  CredentialsProvider({
    id: "credentials",
    name: "Password",
    credentials: {
      email:    { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      const email = (credentials?.email as string | undefined)?.toLowerCase().trim();
      const password = credentials?.password as string | undefined;
      if (!email || !password) return null;

      await connectDB();
      const user = await UserModel.findOne({ email });
      if (!user?.passwordHash) return null;
      if (user.pendingDeleteAt) return null;

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) return null;

      return {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role,
        roles: user.roles?.length ? user.roles : [user.role],
        tenantId: user.tenantId ?? user._id.toString(),
        onboardingComplete: user.onboardingComplete,
      } as GoogleUser & { email: string; name?: string };
    },
  }),
];

export const authConfig: NextAuthConfig = {
  providers,
  secret: AMPLIFY_CONFIG.authSecret,
  trustHost: true,
  // SECURITY: debug logs the full provider config (incl. clientSecret) to stdout.
  // Keep it OFF by default everywhere — only enable via explicit opt-in AND never in
  // production — so a misconfigured NODE_ENV can never leak the OAuth secret to logs.
  debug: process.env.NODE_ENV !== "production" && process.env.AUTH_DEBUG === "true",

  pages: {
    signIn:  "/login",
    signOut: "/login",
    error:   "/login",
  },

  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google" && user.email) {
        const u = user as GoogleUser;

        const applyPendingNewUser = () => {
          u.id                  = account.providerAccountId;
          u.role                = "pending";
          u.roles               = [];
          u.tenantId            = undefined;
          u.onboardingComplete  = false;
          u.pendingRegistration = true;
        };

        try {
          await connectDB();
          const existing = await UserModel.findOne({ email: user.email.toLowerCase() });

          if (!existing) {
            applyPendingNewUser();
            // No User doc is created here (deferred until onboarding completes) —
            // this is the only server-side moment we can record that this email
            // *attempted* sign-in, so admins can see "stuck at pending registration"
            // even though nothing else gets persisted for it.
            await logSystemEvent({
              category: "auth", action: "pending_registration_started",
              email: user.email.toLowerCase(),
            });
          } else {
            const pendingDeleteAt = existing.pendingDeleteAt;
            if (pendingDeleteAt) {
              console.warn("[signIn] blocked deleted/pending-delete account:", user.email);
              return false;
            }
            if (!existing.googleId) {
              await UserModel.findByIdAndUpdate(existing._id, {
                googleId: account.providerAccountId,
                image:    user.image,
              });
            }
            u.id = existing._id.toString();
            u.role = existing.role;
            u.roles = [...(existing.roles?.length ? existing.roles : [existing.role])];
            u.tenantId = existing.tenantId ?? existing._id.toString();
            u.onboardingComplete = existing.onboardingComplete;
            u.pendingDeleteAt = undefined;
            u.deletedByAdmin  = existing.deletedByAdmin ?? false;
          }
        } catch (err) {
          // DB down or auth error — allow new sign-up (Case C) so Google OAuth does not show AccessDenied
          console.error("[signIn] DB lookup failed, deferring registration:", err);
          applyPendingNewUser();
        }
      }
      return true;
    },

    async jwt({ token, user, trigger, session: updatePayload }) {
      if (user) {
        const t = token as ZudobotJWT;
        const u = user as GoogleUser;
        if (user.email) t.email = user.email;
        t.sub                = u.id;
        t.role               = u.role;
        t.roles              = [...(u.roles ?? [])];
        t.tenantId           = u.tenantId;
        t.onboardingComplete = u.onboardingComplete;
        t.pendingDeleteAt    = u.pendingDeleteAt;
        t.deletedByAdmin     = u.deletedByAdmin;

        if (u.pendingRegistration) {
          // C path: no DB user yet — store Google sub + email for later lookup, skip 2FA check
          t.pendingRegistration = true;
          t.googleSub = u.id;
          if (user.email) t.email = user.email;
          return token;
        }

        // Check if this user has 2FA enabled — if so, mark session as pending
        if (u.id) {
          try {
            await connectDB();
            const dbUser = await UserModel.findById(u.id).select("twoFactorEnabled twoFactorVerified").lean();
            const db = dbUser as { twoFactorEnabled?: boolean; twoFactorVerified?: boolean } | null;
            if (db?.twoFactorEnabled && db?.twoFactorVerified) {
              t.twoFaPending = true;
            }
          } catch {
            // non-critical — allow login without 2FA check on DB error
          }
        }
      }
      // Auto-clear expired impersonation (runs on every token read)
      const imp = (token as ZudobotJWT).impersonating;
      if (imp && imp.expiresAt < Math.floor(Date.now() / 1000)) {
        const t = token as ZudobotJWT;
        t.tenantId = imp.originalTenantId;
        t.role     = imp.originalRole;
        delete t.impersonating;
      }

      // When client calls update() — re-fetch from DB (onboarding complete, 2FA clear, pending → real ID)
      if (trigger === "update") {
        const t = token as ZudobotJWT;
        const payload = updatePayload as Record<string, unknown> | undefined;

        // Handle impersonation actions (no DB needed)
        if (payload?.action === "impersonate") {
          t.impersonating = {
            originalTenantId: (t.tenantId ?? t.sub) as string,
            originalRole:     t.role as string,
            clientName:       payload.clientName as string,
            partnerId:        payload.partnerId  as string,
            expiresAt:        Math.floor(Date.now() / 1000) + 7200,
          };
          t.tenantId = payload.tenantId as string;
          return token;
        }

        if (payload?.action === "deimpersonate") {
          const prev = t.impersonating;
          if (prev) {
            t.tenantId = prev.originalTenantId;
            t.role     = prev.originalRole;
            delete t.impersonating;
          }
          return token;
        }

        try {
          await connectDB();
          if (t.pendingRegistration) {
            await resolvePendingRegistrationToken(t);
          } else if (token.sub && /^[a-f\d]{24}$/i.test(token.sub as string)) {
            // Normal update: existing user re-fetched from DB
            const dbUser = await UserModel.findById(token.sub).lean();
            if (dbUser) {
              const db = dbUser as { onboardingComplete?: boolean; role?: string; roles?: string[]; pendingDeleteAt?: Date; deletedByAdmin?: boolean };
              t.onboardingComplete = db.onboardingComplete;
              t.role               = db.role;
              t.roles              = db.roles?.length ? db.roles : (db.role ? [db.role] : []);
              // Sync pending-delete state so middleware reflects recovery/restore immediately
              t.pendingDeleteAt    = db.pendingDeleteAt?.toISOString();
              t.deletedByAdmin     = db.deletedByAdmin ?? false;
            }
          }
        } catch {
          // keep existing token values on DB error
        }
      }
      return token;
    },

    async session({ session, token }) {
      const s = session as ZudobotSession;
      const t = token as ZudobotJWT;
      if (s.user) {
        s.user.id                = t.sub;
        s.user.role              = t.role;
        s.user.roles             = t.roles;
        s.user.tenantId          = t.tenantId;
        s.user.onboardingComplete = t.onboardingComplete;
        s.user.pendingDeleteAt   = t.pendingDeleteAt;
        s.user.deletedByAdmin    = t.deletedByAdmin;
        if (t.impersonating) {
          const { originalRole: _r, ...rest } = t.impersonating;
          void _r;
          s.user.impersonating = rest;
        } else {
          s.user.impersonating = undefined;
        }
      }
      return s;
    },
  },

  session: { strategy: "jwt" },

  events: {
    async signIn({ user, account }) {
      try {
        if (user?.email) {
          await logSystemEvent({
            category: "auth",
            action:   "login",
            email:    user.email.toLowerCase(),
            details:  { provider: account?.provider },
          });
        }
      } catch {
        // Logging must never block sign-in
      }
    },
    async signOut(message) {
      try {
        const token = (message as { token?: { email?: string } })?.token;
        if (token?.email) {
          await logSystemEvent({ category: "auth", action: "logout", email: token.email.toLowerCase() });
        }
      } catch {
        // Logging must never block sign-out
      }
    },
  },
};
