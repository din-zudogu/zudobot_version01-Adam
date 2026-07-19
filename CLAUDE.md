# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Dev commands

```bash
# Root — run all apps in parallel
npm run dev          # web (port 3000) + api (port 4000)

# Individual apps
cd apps/web && npm run dev      # Next.js web + landing + admin + dashboard
cd apps/api && npm run dev      # Chatbot API (port 4000)

# Widget (must build before web if widget changed)
npm run build:widget            # from root — builds packages/widget, copies to apps/web/public/

# Build + lint
cd apps/web && npm run build
cd apps/web && npm run lint

# DB seed helper (dev only)
cd apps/web && npm run db:insert-mock-global-tenant
```

## Architecture overview

**Monorepo** — npm workspaces: `apps/web`, `apps/api`, `apps/dashboard`, `packages/widget`, `apps/landing`

| App | Purpose | Port |
|-----|---------|------|
| `apps/web` | Landing page + Admin panel + Tenant dashboard + Auth + API routes | 3000 |
| `apps/api` | Chatbot widget API (receives messages from embedded widget) | 4000 |
| `apps/dashboard` | Standalone dashboard (separate Amplify deploy) | — |
| `packages/widget` | Vite-built JS widget embedded on customer sites | — |
| `apps/landing` | Static HTML landing page (separate Amplify app) | — |

All apps share one MongoDB database: `zudobot_saas` (single Atlas cluster) — this remains canonical for all existing models.

**PostgreSQL (Neon) — new features/modules only.** Existing data stays on MongoDB; do not migrate existing collections. New Postgres-backed features use Drizzle ORM (`apps/web/lib/db/postgres.ts` → `getPostgresDb()`), schema in `apps/web/lib/db/pg/schema.ts`, migrations via `npm run pg:generate` / `pg:migrate` (config: `apps/web/drizzle.config.ts`). `DATABASE_URL`/`DIRECT_URL` are optional in `AMPLIFY_CONFIG` (not in the required-var guardrail set) — `getPostgresDb()` throws its own clear error if unset, so only Postgres-backed code paths are affected.

## CRITICAL — Environment variables

> These rules override everything. Never break them.

1. **All env vars come from AWS Amplify Console only.** No `.env` files in `apps/web`, `apps/api`, `apps/dashboard` — these apps must crash with a clear error if a var is missing.
2. **No dotenv in app code.** `apps/web/lib/env/amplifyGuardrail.ts` enforces this at startup.
3. **No fallbacks.** `process.env.X || 'default'` is forbidden in app code.
4. **Scripts exception.** `scripts/*.mjs` may read from `.env.aws.local` or call `scripts/lib/loadAmplifyEnv.mjs` for IAM bootstrap only.
5. **New server-side secret? Update `amplify.yml` too.** Amplify Hosting Compute only exposes Console env vars at *build* time — the deployed Lambda's runtime `process.env` doesn't get them automatically. `amplify.yml`'s `build.commands` writes the known var list into `apps/web/.env.production` (Next.js loads that at runtime). Adding a var to `amplifyGuardrail.ts` or reading a new `process.env.X` anywhere in `apps/web` server code means adding its name to that same list in `amplify.yml`, or it'll be `undefined` in production even though it works locally and at build time.

Access env in `apps/web` via the `AMPLIFY_CONFIG` getter object from `@/lib/env/amplifyGuardrail.ts`.

## Auth (NextAuth v5 beta)

- **Google OAuth (primary) + password (secondary, opt-in).** Google Sign-In is the only way to *create* an account — there is no password-based signup. A password is established only via the forgot-password flow, on an email that already went through Google-first onboarding, using a NextAuth `CredentialsProvider` (`apps/web/lib/auth/config.ts`) + `UserModel.passwordHash` (bcrypt, cost 12). An account with no `passwordHash` set cannot log in via password.
- Roles: `super_admin`, `admin` (= `super_admin` alias), `tenant`, `partner_admin`.
- JWT strategy (no DB sessions).
- **Deferred user creation (B+C paths) — Google flow only:** User doc is NOT created at Google sign-in. The JWT carries `pendingRegistration: true` with `googleSub`. The doc is written only when the onboarding wizard completes. Credentials (password) logins never go through this path — an unknown email or missing `passwordHash` is a hard reject, never a new pending registration.
- Impersonation: `partner_admin` can impersonate a tenant; JWT has `impersonating: true` + `realRole`.

## Database models

- `User._id` (ObjectId) is the canonical identity. `User.tenantId` (string) is usually `_id.toString()`.
- Most web-side collections use `tenantId: string`. `ChatSession` uses `tenantId: ObjectId`.
- Always query `ChatSession` with both string and ObjectId forms (`tenantOrOidQ` pattern).
- Protected account: `zudogu.official@gmail.com` is the super admin — never delete, never modify.
- `PartnerProfile` links by both `userId` and `email`.
- `VipTenant` links by both `email` and `tenantId`.

Key model exports: `UserModel`, `TenantProfileModel`, `SubscriptionModel`, `ZudobotConfig` (NOT `ZudobotConfigModel`).

## Bot state machine

States (in order): `trial → trial_quota_daily_exhausted → trial_expired → active → grace_5pct → suspended_quota | suspended_payment → disabled`

Pure function: `evaluateBotState(ctx)` in `apps/web/lib/payment/botStateMachine.ts` — no DB, returns `{ nextState, reason }`.

## Plan catalog

| Plan | Price (THB) | Messages |
|------|------------|---------|
| trial | 0 | 250/day |
| starter | 990/mo | 2,000/mo |
| pro | 1,990/mo | 5,000/mo |
| master | 14,990/mo | 20,000/mo |
| enterprise | custom | unlimited |

Addons: quota, memory, retention — defined in `apps/web/lib/payment/pmRules.ts`.

## Widget build pipeline

`amplify.yml` pre-build:
1. `npm run build:widget` → `packages/widget/dist/widget.js`
2. Copy to `apps/web/public/`
3. Auto-compute SRI hash → `NEXT_PUBLIC_WIDGET_SCRIPT_INTEGRITY` env var
4. Dump selected env vars to `.env.production` files

Widget is embedded on customer sites via a one-line `<script>` tag with SRI integrity check.

## Infrastructure (Phase 0)

- **AWS Amplify** (ap-southeast-1 Singapore) — sole deployment target.
- **MongoDB Atlas** — `0.0.0.0/0` IP allow-list is intentional Phase 0 trade-off (strong password + audit log compensates). Do not change without Phase 1 upgrade (NAT Gateway, VPC peering).
- **Stripe** — subscriptions + webhooks + Connect for partners.
- **Gemini AI** — `GEMINI_API_KEY` (dev) or `GEMINI_API_KEY_LIVE` (prod); at least one required.

## Landing page SEO / AI visibility

JSON-LD schemas live in `apps/web/app/page.tsx` (inline `<script type="application/ld+json">`). Schemas: Organization, SoftwareApplication, FAQPage, WebSite, WebPage.

New content sections for AI visibility (in order in page.tsx): HeroSection → SandboxPreviewSection → HowItWorksSection → FeaturesSection → UseCasesSection → TestimonialsSection → ReadyPackagePricingSection → FaqSection → CtaSection → BlogPreviewSection.

Blog articles live at `apps/web/app/blog/[slug]/page.tsx`. Blog index at `apps/web/app/blog/page.tsx`.

## Account deletion

Admin endpoint: `POST /api/admin/delete-account` — `super_admin` only. Body: `{ email, confirm: boolean }`. `confirm: false` = dry-run. Cascades across 18+ collections including partner sub-collections. Refuses to delete `zudogu.official@gmail.com`.
