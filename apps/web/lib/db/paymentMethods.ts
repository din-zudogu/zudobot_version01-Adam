import { and, desc, eq } from "drizzle-orm";
import { getPostgresDb } from "@/lib/db/postgres";
import { paymentMethodConfig, paymentTrans } from "@/lib/db/pg/schema";

// Thin query helpers over the tenant Payment Methods tables — keeps route
// handlers free of raw Drizzle query-building (mirrors lib/db/gitInstall.ts
// / lib/db/referral.ts).

export type PaymentMethodConfigRow = typeof paymentMethodConfig.$inferSelect;
export type PaymentTransRow = typeof paymentTrans.$inferSelect;

export async function getPaymentMethodConfig(tenantId: string): Promise<PaymentMethodConfigRow | null> {
  const db = getPostgresDb();
  const [row] = await db.select().from(paymentMethodConfig).where(eq(paymentMethodConfig.tenantId, tenantId)).limit(1);
  return row ?? null;
}

export async function upsertPaymentMethodConfig(input: {
  tenantId: string;
  promptpayId?: string | null;
  promptpayEnabled?: boolean;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankAccountName?: string | null;
  bankTransferEnabled?: boolean;
}): Promise<PaymentMethodConfigRow> {
  const db = getPostgresDb();
  const existing = await getPaymentMethodConfig(input.tenantId);

  if (existing) {
    const [row] = await db
      .update(paymentMethodConfig)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(paymentMethodConfig.tenantId, input.tenantId))
      .returning();
    return row;
  }

  const [row] = await db.insert(paymentMethodConfig).values(input).returning();
  return row;
}

export async function createPaymentTrans(input: {
  tenantId: string;
  amountThb: string;
  method: string;
  sessionId?: string;
  slipS3Key?: string;
  verificationMethod: string;
  confidence?: number;
  extractedBankName?: string | null;
  extractedRef?: string | null;
  extractedDateTime?: string | null;
  status: string;
}): Promise<PaymentTransRow> {
  const db = getPostgresDb();
  const [row] = await db.insert(paymentTrans).values(input).returning();
  return row;
}

export async function listPaymentTransForTenant(tenantId: string): Promise<PaymentTransRow[]> {
  const db = getPostgresDb();
  return db.select().from(paymentTrans).where(eq(paymentTrans.tenantId, tenantId)).orderBy(desc(paymentTrans.createdAt));
}

export async function listAllPaymentTrans(): Promise<PaymentTransRow[]> {
  const db = getPostgresDb();
  return db.select().from(paymentTrans).orderBy(desc(paymentTrans.createdAt));
}

export async function getPaymentTransById(id: string, tenantId: string): Promise<PaymentTransRow | null> {
  const db = getPostgresDb();
  const [row] = await db
    .select()
    .from(paymentTrans)
    .where(and(eq(paymentTrans.id, id), eq(paymentTrans.tenantId, tenantId)))
    .limit(1);
  return row ?? null;
}

export async function reviewPaymentTrans(
  id: string,
  tenantId: string,
  status: "confirmed" | "rejected",
  reviewedBy: string
): Promise<PaymentTransRow | null> {
  const db = getPostgresDb();
  const [row] = await db
    .update(paymentTrans)
    .set({ status, reviewedBy, reviewedAt: new Date() })
    .where(and(eq(paymentTrans.id, id), eq(paymentTrans.tenantId, tenantId)))
    .returning();
  return row ?? null;
}
