/**
 * Zudobot Cost Rate Constants
 * Source: ตารางต้นทุนจริง พ.ค.–มิ.ย. 2569
 * Update this file when provider pricing changes — do NOT hardcode rates elsewhere.
 */

// ─── FX Rate ──────────────────────────────────────────────────────────────────

/** USD → THB exchange rate (Anthropic API pricing reference, May–Jun 2026) */
export const DEFAULT_USD_TO_THB = 32.71;

// ─── AI Token Rates (THB per token) ──────────────────────────────────────────
// Formula: (USD_per_1M / 1_000_000) × USD_TO_THB

export const AI_TOKEN_RATES = {
  haiku: {
    input:  0.00003271,   // $1.00/1M  × 32.71
    output: 0.00016355,   // $5.00/1M  × 32.71
  },
  sonnet: {
    input:  0.00009813,   // $3.00/1M  × 32.71
    output: 0.00049065,   // $15.00/1M × 32.71
  },
  opus: {
    input:  0.00016355,   // $5.00/1M  × 32.71
    output: 0.00081775,   // $25.00/1M × 32.71
  },
} as const;

export type AiModel = keyof typeof AI_TOKEN_RATES;

// ─── Storage Rates (THB per MB per month) ─────────────────────────────────────
// Formula: (USD_per_GB / 1024) × USD_TO_THB

export const STORAGE_RATES_PER_MB: Record<StorageProvider, number> = {
  b2:     0.00019166,   // Backblaze B2   $0.006/GB
  wasabi: 0.00022041,   // Wasabi         $0.0069/GB
  r2:     0.00047915,   // Cloudflare R2  $0.015/GB
  s3:     0.00073470,   // AWS S3 Std     $0.023/GB
  gcs:    0.00063887,   // Google Cloud   $0.020/GB
};

// ─── Egress Rates (THB per MB) ────────────────────────────────────────────────
// B2 via Cloudflare CDN = ฿0; Wasabi/R2 = ฿0 (free)

export const EGRESS_RATES_PER_MB: Record<StorageProvider, number> = {
  b2:     0.00031943,   // $0.010/GB — free if useCloudflareB2=true
  wasabi: 0.00000000,   // free (reasonable use)
  r2:     0.00000000,   // free unlimited
  s3:     0.00287490,   // $0.090/GB — expensive
  gcs:    0.00383320,   // $0.120/GB — most expensive
};

export type StorageProvider = "b2" | "wasabi" | "r2" | "s3" | "gcs";

// ─── Payment Gateway Rates ────────────────────────────────────────────────────

export const GATEWAY_RATES: Record<PaymentMethod, number> = {
  stripe_card:     0.0365,   // 3.65% of transaction
  stripe_promptpay:0.0165,   // 1.65%
  stripe_intl:     0.0365,   // 3.65% base + INTL_SURCHARGE below
  opn_card:        0.0365,   // 3.65%
  opn_promptpay:   0.0165,   // 1.65%
  qr:              0,         // flat rate per tx (see QR_FLAT_RATE_THB)
};

/** Additional surcharge for international cards (Stripe international) */
export const INTL_CARD_SURCHARGE = 0.0200;

/** FX conversion fee (when merchant receives non-THB) */
export const FX_CONVERSION_PCT = 0.0200;

/** QR / Mobile banking flat rate per transaction (THB) */
export const QR_FLAT_RATE_THB = 12.00;

export type PaymentMethod =
  | "stripe_card"
  | "stripe_promptpay"
  | "stripe_intl"
  | "opn_card"
  | "opn_promptpay"
  | "qr";

// ─── Email (THB per email) ────────────────────────────────────────────────────

export const EMAIL_RATES_PER_EMAIL: Record<EmailService, number> = {
  ses:      0.003271,   // Amazon SES  $0.10/1000 × 32.71
  sendgrid: 0.011449,   // SendGrid    $0.35/1000 × 32.71
  none:     0,
};

export type EmailService = "ses" | "sendgrid" | "none";

// ─── SMS (THB per message) ────────────────────────────────────────────────────

/** SMS OTP — Thai gateway, approx ฿0.25–0.45; use midpoint */
export const SMS_OTP_RATE_THB = 0.40;

// ─── Infrastructure ───────────────────────────────────────────────────────────

/** Serverless function (฿ per request) — $0.20/1M × 32.71 */
export const SERVERLESS_FN_RATE_PER_REQ = 0.0000065;

/** Managed DB (฿ per MB per month) — $0.25/GB/month ÷ 1024 × 32.71 */
export const MANAGED_DB_RATE_PER_MB = 0.007986;

/** .com domain amortized per month — ฿392.52/year ÷ 12 */
export const DOMAIN_COM_MONTHLY_THB = 32.71;

/** Let's Encrypt SSL — free */
export const SSL_MONTHLY_THB = 0;

/** AI image generation — $0.03/image × 32.71 */
export const AI_IMAGE_RATE_PER_IMAGE = 0.9813;

// ─── Discount modifiers ───────────────────────────────────────────────────────

/** Prompt caching: input tokens charged at 10% (90% discount) */
export const PROMPT_CACHE_INPUT_MULTIPLIER = 0.10;

/** Batch processing: all tokens charged at 50% */
export const BATCH_PROCESSING_MULTIPLIER = 0.50;

// ─── Configurable rate override interface ─────────────────────────────────────

export interface CostRateConfig {
  usdToThb: number;
  aiTokenRates: typeof AI_TOKEN_RATES;
  storageRatesPerMb: Record<StorageProvider, number>;
  egressRatesPerMb: Record<StorageProvider, number>;
  gatewayRates: Record<PaymentMethod, number>;
  intlCardSurcharge: number;
  qrFlatRateThb: number;
  emailRatesPerEmail: Record<EmailService, number>;
  smsRateThb: number;
  serverlessFnRatePerReq: number;
  managedDbRatePerMb: number;
  domainComMonthlyThb: number;
  aiImageRatePerImage: number;
}

export function getDefaultRateConfig(): CostRateConfig {
  return {
    usdToThb:              DEFAULT_USD_TO_THB,
    aiTokenRates:          AI_TOKEN_RATES,
    storageRatesPerMb:     STORAGE_RATES_PER_MB,
    egressRatesPerMb:      EGRESS_RATES_PER_MB,
    gatewayRates:          GATEWAY_RATES,
    intlCardSurcharge:     INTL_CARD_SURCHARGE,
    qrFlatRateThb:         QR_FLAT_RATE_THB,
    emailRatesPerEmail:    EMAIL_RATES_PER_EMAIL,
    smsRateThb:            SMS_OTP_RATE_THB,
    serverlessFnRatePerReq:SERVERLESS_FN_RATE_PER_REQ,
    managedDbRatePerMb:    MANAGED_DB_RATE_PER_MB,
    domainComMonthlyThb:   DOMAIN_COM_MONTHLY_THB,
    aiImageRatePerImage:   AI_IMAGE_RATE_PER_IMAGE,
  };
}
