"use client";

interface PackageItem {
  plan:               string;
  packageName:        string;
  messageCount?:      number;
  tokensPerMessage?:  number;
  storageExpireDays?: number;
  trialDurationDays?: number;
}

interface Props {
  name:             string;
  isTrial:          boolean;
  trialDays?:       number;
  finalRetailPrice: number;
  items:            PackageItem[];
}

const STANDARD_FEATURES = [
  "แจ้งเตือนแอดมินผ่านไลน์",
  "สนทนาได้ 24 ชั่วโมง",
  "แนะนำสินค้าที่ลูกค้าสนใจ",
  "จดจำบทสนทนากับลูกค้าเดิม",
  "AI สามารถเรียนรู้ธุรกิจสินค้าและบริการได้",
];

function thb(n: number) {
  if (n <= 0) return "ฟรี";
  return `฿${n.toLocaleString("th-TH")}`;
}

function itemSpec(item: PackageItem): string {
  const parts: string[] = [];
  const p = (item.plan + " " + item.packageName).toLowerCase();
  if (p.includes("expired") && item.storageExpireDays) {
    parts.push(`เก็บประวัติ ${item.storageExpireDays} วัน`);
  } else if (p.includes("storage") && item.messageCount) {
    const mb = Math.round(item.messageCount * 8);
    parts.push(`~${item.messageCount.toLocaleString("th-TH")} ข้อความ / ~${mb.toLocaleString("th-TH")} MB`);
  } else if (item.messageCount) {
    parts.push(`${item.messageCount.toLocaleString("th-TH")} ข้อความ/เดือน`);
    if (item.tokensPerMessage && item.messageCount) {
      const tok = item.messageCount * item.tokensPerMessage;
      parts.push(`~${tok.toLocaleString("th-TH")} tokens/เดือน`);
    }
  }
  if (item.trialDurationDays) parts.push(`ทดลองใช้ ${item.trialDurationDays} วัน`);
  return parts.join(" · ");
}

export function ReadyPackageCheckoutSection({ name, isTrial, trialDays, finalRetailPrice, items }: Props) {
  return (
    <div className={`rounded-xl border-2 p-6 ${isTrial ? "border-amber-300 bg-amber-50" : "border-brand-500 bg-white"}`}>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          {isTrial && (
            <span className="inline-block mb-2 px-3 py-0.5 rounded-full text-xs font-bold bg-amber-400 text-amber-900">
              🎁 ทดลองใช้ฟรี {trialDays ?? 14} วัน
            </span>
          )}
          <h2 className={`text-xl font-bold ${isTrial ? "text-amber-900" : "text-text-primary"}`}>{name}</h2>
        </div>
        <div className="text-right shrink-0">
          <p className={`text-3xl font-black ${isTrial ? "text-amber-700" : "text-brand-600"}`}>
            {thb(finalRetailPrice)}
          </p>
          {!isTrial && finalRetailPrice > 0 && (
            <p className="text-xs text-text-muted">/เดือน</p>
          )}
          {isTrial && <p className="text-xs text-amber-600">{trialDays ?? 14} วัน</p>}
        </div>
      </div>

      {/* Spec from items */}
      {items.length > 0 && (
        <div className="space-y-1.5 mb-4">
          {items.map((item, i) => {
            const spec = itemSpec(item);
            if (!spec) return null;
            const p = (item.plan + " " + item.packageName).toLowerCase();
            const icon = p.includes("expired") ? "🗂" : p.includes("storage") ? "💾" : "📱";
            return (
              <div key={i} className="flex items-start gap-2 text-sm">
                <span>{icon}</span>
                <div>
                  <span className="font-medium text-text-primary">
                    {item.plan}{item.packageName ? ` · ${item.packageName}` : ""}
                  </span>
                  {spec && <span className="text-text-muted ml-2">— {spec}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Standard features */}
      <div className={`rounded-lg p-3 ${isTrial ? "bg-amber-100/60" : "bg-surface-secondary"}`}>
        <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">สิทธิ์พื้นฐานที่ได้รับ</p>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1">
          {STANDARD_FEATURES.map((f, i) => (
            <li key={i} className="flex items-center gap-1.5 text-xs text-text-secondary">
              <span className="text-emerald-500">✓</span> {f}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
