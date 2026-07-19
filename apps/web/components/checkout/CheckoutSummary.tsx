"use client";

import { useMemo } from "react";

export interface SelectedAddon {
  _id:              string;
  label:            string;
  plan:             string;
  packageName:      string;
  bestPriceZudobot: number;
}

interface Props {
  packageName:       string;
  packagePrice:      number;
  isTrial:           boolean;
  selectedAddons:    SelectedAddon[];
  onCheckout:        () => void;
  loading:           boolean;
}

function thb(n: number) {
  return `฿${n.toLocaleString("th-TH")}`;
}

export function CheckoutSummary({
  packageName,
  packagePrice,
  isTrial,
  selectedAddons,
  onCheckout,
  loading,
}: Props) {
  const { subtotal, vat, total } = useMemo(() => {
    const addonsTotal = selectedAddons.reduce((s, a) => s + a.bestPriceZudobot, 0);
    const sub  = packagePrice + addonsTotal;
    const v    = Math.round(sub * 0.07);
    const t    = sub + v;
    return { subtotal: sub, vat: v, total: t };
  }, [packagePrice, selectedAddons]);

  if (isTrial) {
    return (
      <div className="sticky top-24 rounded-2xl border-2 border-amber-200 bg-amber-50 p-6 space-y-4">
        <h3 className="font-bold text-amber-900">สรุปรายการ</h3>
        <div className="flex justify-between text-sm">
          <span className="text-amber-800">{packageName}</span>
          <span className="font-bold text-amber-600">ฟรี</span>
        </div>
        <div className="border-t border-amber-200 pt-3">
          <div className="flex justify-between font-bold text-amber-900 text-lg">
            <span>ยอดรวม</span>
            <span>ฟรี</span>
          </div>
        </div>
        <button
          type="button"
          onClick={onCheckout}
          disabled={loading}
          className="w-full py-3 rounded-xl bg-amber-500 text-white font-bold text-sm hover:bg-amber-600 disabled:opacity-50 transition-colors"
        >
          {loading ? "กำลังดำเนินการ..." : "เริ่มทดลองใช้ฟรี →"}
        </button>
        <p className="text-center text-xs text-amber-600">ไม่ต้องผูกบัตรเครดิต</p>
      </div>
    );
  }

  return (
    <div className="sticky top-24 rounded-2xl border border-border-default bg-white shadow-sm p-6 space-y-4">
      <h3 className="font-bold text-text-primary">สรุปรายการ</h3>

      {/* Line items */}
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-text-secondary">{packageName}</span>
          <span className="font-semibold">{thb(packagePrice)}</span>
        </div>
        {selectedAddons.map((addon) => (
          <div key={addon._id} className="flex justify-between">
            <span className="text-text-secondary">
              + {addon.plan}{addon.packageName ? ` · ${addon.packageName}` : ""}
            </span>
            <span className="font-semibold text-brand-600">+{thb(addon.bestPriceZudobot)}</span>
          </div>
        ))}
      </div>

      {/* Totals */}
      <div className="border-t border-border-default pt-3 space-y-1.5 text-sm">
        <div className="flex justify-between text-text-muted">
          <span>Subtotal</span>
          <span>{thb(subtotal)}</span>
        </div>
        <div className="flex justify-between text-text-muted">
          <span>VAT 7%</span>
          <span>+{thb(vat)}</span>
        </div>
        <div className="flex justify-between font-bold text-text-primary text-base pt-1.5 border-t border-border-default">
          <span>ยอดรวม (รวม VAT)</span>
          <span className="text-brand-600">{thb(total)}</span>
        </div>
        <p className="text-xs text-text-muted text-right">/เดือน</p>
      </div>

      <button
        type="button"
        onClick={onCheckout}
        disabled={loading || subtotal === 0}
        className="w-full py-3 rounded-xl bg-brand-600 text-white font-bold text-sm hover:bg-brand-700 disabled:opacity-50 transition-colors"
      >
        {loading ? "กำลังดำเนินการ..." : "ชำระเงินด้วย Stripe →"}
      </button>

      <div className="space-y-1">
        <p className="text-center text-xs text-text-muted">🔒 ชำระผ่าน Stripe · ปลอดภัย 100%</p>
        <ul className="text-xs text-text-muted space-y-0.5 mt-2">
          <li>✓ ยกเลิกได้ทุกเมื่อ ไม่มีค่าปรับ</li>
          <li>✓ ชำระรายเดือน ต่ออายุอัตโนมัติ</li>
          <li>✓ ใบกำกับภาษีออกโดย Zudogu Co., Ltd.</li>
        </ul>
      </div>
    </div>
  );
}
