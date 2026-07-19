import { SubscriptionModel } from "@/lib/db/models/Subscription";

/**
 * นับจำนวนร้านค้า (distinct tenant) ที่เคยใช้แต่ละแพคเกจสำเร็จรูป
 *
 * นโยบาย "ใช้แล้วใช้เลย" — นับทุกร้านที่เคยรับแพคเกจนี้ ไม่ว่าจะยกเลิก/หมดอายุ
 * ไปแล้วหรือไม่ (ไม่มีการคืนสิทธิ์โควต้า) จึงไม่กรองตาม status
 *
 * @returns map: readyPackageId → จำนวนร้านค้าที่เคยใช้
 */
export async function countReadyPackageUsage(
  packageIds: string[],
): Promise<Record<string, number>> {
  const ids = packageIds.filter(Boolean);
  if (ids.length === 0) return {};

  const rows = await SubscriptionModel.aggregate<{ _id: string; count: number }>([
    { $match: { readyPackageId: { $in: ids } } },
    // distinct (package, tenant) กันนับซ้ำเผื่อมี subscription ซ้ำต่อ tenant
    { $group: { _id: { pkg: "$readyPackageId", tenant: "$tenantId" } } },
    { $group: { _id: "$_id.pkg", count: { $sum: 1 } } },
  ]);

  const out: Record<string, number> = {};
  for (const r of rows) out[String(r._id)] = r.count;
  return out;
}

/** นับจำนวนร้านค้าที่เคยใช้แพคเกจเดียว */
export async function countReadyPackageUsageOne(packageId: string): Promise<number> {
  const map = await countReadyPackageUsage([packageId]);
  return map[packageId] ?? 0;
}

/**
 * ร้านค้าใหม่ (สมัครใหม่) = ยังไม่เคยเป็นลูกค้าที่ชำระเงินมาก่อน
 * — ไม่มี subscription ที่ผูกกับ Stripe (stripeSubId) และไม่เคยมีสถานะ
 *   active / past_due / paused (เคยจ่ายเงินจริง)
 *
 * ใช้กับแพคเกจที่ตั้งค่า newShopsOnly = true (เช่นโปรฯ "100 ร้านแรก")
 */
export async function isNewShop(tenantId: string): Promise<boolean> {
  const everPaid = await SubscriptionModel.findOne({
    tenantId,
    $or: [
      { stripeSubId: { $exists: true, $nin: [null, ""] } },
      { status: { $in: ["active", "past_due", "paused"] } },
    ],
  }).lean();
  return !everPaid;
}
