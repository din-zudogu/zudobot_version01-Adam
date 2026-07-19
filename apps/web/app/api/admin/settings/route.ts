import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { connectDB } from "@/lib/db/connect";
import { PlatformSettingsModel, getPlatformSettings } from "@/lib/db/models/PlatformSettings";

function isAdminOrSuperAdmin(role?: string) {
  return role === "admin" || role === "super_admin";
}

// GET — any admin can read
export async function GET(req: NextRequest) {
  const token = await getServerToken(req);
  if (!isAdminOrSuperAdmin(token?.role as string)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    await connectDB();
    const settings = await getPlatformSettings();
    return NextResponse.json({ settings });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

// PUT — super_admin only
export async function PUT(req: NextRequest) {
  const token = await getServerToken(req);
  if (token?.role !== "super_admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: Partial<Record<string, unknown>>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  // Strip non-whitelisted keys (only allow known setting fields)
  const ALLOWED_KEYS = new Set([
    "trialDurationDays","trialDailyQuotaCap","trialQuotaExhaustedBotMessage",
    "trialQuotaExhaustedEmailSubject","trialQuotaExhaustedEmailBody",
    "quotaAlertThresholds","quotaGraceBufferPercent","quotaExhaustedBotMessage",
    "nonEnterpriseRenewalGraceDays","enterpriseInvoiceGraceDays","enterpriseBillingAlertDays",
    "sessionTimeoutMinutes","minimumEngagementSeconds","amnesiaMessageTemplate",
    "retentionWarningDays","geminiDownMessage",
    "centralizedRetentionYears","centralizedCleanupDayOfMonth",
    "sandboxRateLimitPerHour","sandboxAccountMessageLimit",
    "sandboxCtaTriggerAfterMessages","sandboxCtaMessage",
    "vatRate","enterpriseCostPlusMultiplier","whtRate",
    "widgetCdnBaseUrl","widgetStableVersion","widgetLatestVersion",
    "privacyPolicyHtml","privacyPolicyUrl","widgetDisclaimerMessage","pdpaContextLink",
    "invoiceSellerName","invoiceSellerTaxId","invoiceSellerAddress","invoiceSellerPhone",
    "invoiceSellerEmail","invoiceSellerIsVatRegistered","invoiceNumberPrefix","invoiceDueDays",
    "invoiceWhtThreshold","invoiceReceiptFooterNote","invoiceReceiptShowVat","invoiceReceiptShowWht",
  ]);

  const update: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (ALLOWED_KEYS.has(k)) update[k] = v;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "no_valid_fields" }, { status: 400 });
  }

  try {
    await connectDB();
    const settings = await PlatformSettingsModel.findOneAndUpdate(
      {},
      { $set: update },
      { upsert: true, new: true }
    );
    return NextResponse.json({ ok: true, settings });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "server_error";
    console.error("[admin/settings PUT]", msg);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
