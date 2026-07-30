import { NextRequest, NextResponse } from "next/server";
import { getServerToken } from "@/lib/auth/getServerToken";
import { ensurePaymentMasterData } from "@/lib/db/pg/ensurePaymentMasterData";
import { getPaymentMethodConfig, upsertPaymentMethodConfig } from "@/lib/db/paymentMethods";
import { generatePromptPayQrDataUrl, isValidPromptPayId } from "@/lib/payment/promptpayQr";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = await getServerToken(req);
  if (!token?.sub || token.role !== "tenant") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const tenantId = token.sub as string;

  try {
    await ensurePaymentMasterData();
    const config = await getPaymentMethodConfig(tenantId);

    let qrDataUrl: string | null = null;
    if (config?.promptpayEnabled && config.promptpayId) {
      try {
        qrDataUrl = await generatePromptPayQrDataUrl(config.promptpayId);
      } catch {
        qrDataUrl = null;
      }
    }

    return NextResponse.json({
      config: config
        ? {
            promptpayId: config.promptpayId,
            promptpayEnabled: config.promptpayEnabled,
            bankName: config.bankName,
            bankAccountNumber: config.bankAccountNumber,
            bankAccountName: config.bankAccountName,
            bankTransferEnabled: config.bankTransferEnabled,
          }
        : null,
      qrDataUrl,
    });
  } catch (err) {
    console.error("[tenant/payment-methods GET] failed:", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

interface PutBody {
  promptpayId?: string;
  promptpayEnabled?: boolean;
  bankName?: string;
  bankAccountNumber?: string;
  bankAccountName?: string;
  bankTransferEnabled?: boolean;
}

export async function PUT(req: NextRequest) {
  const token = await getServerToken(req);
  if (!token?.sub || token.role !== "tenant") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const tenantId = token.sub as string;

  let body: PutBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  if (body.promptpayEnabled && (!body.promptpayId || !isValidPromptPayId(body.promptpayId))) {
    return NextResponse.json({ error: "invalid_promptpay_id" }, { status: 400 });
  }
  if (body.bankTransferEnabled && (!body.bankName?.trim() || !body.bankAccountNumber?.trim() || !body.bankAccountName?.trim())) {
    return NextResponse.json({ error: "missing_bank_details" }, { status: 400 });
  }

  try {
    await ensurePaymentMasterData();
    const config = await upsertPaymentMethodConfig({
      tenantId,
      promptpayId: body.promptpayId?.trim() || null,
      promptpayEnabled: !!body.promptpayEnabled,
      bankName: body.bankName?.trim() || null,
      bankAccountNumber: body.bankAccountNumber?.trim() || null,
      bankAccountName: body.bankAccountName?.trim() || null,
      bankTransferEnabled: !!body.bankTransferEnabled,
    });
    return NextResponse.json({ ok: true, config });
  } catch (err) {
    console.error("[tenant/payment-methods PUT] failed:", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
