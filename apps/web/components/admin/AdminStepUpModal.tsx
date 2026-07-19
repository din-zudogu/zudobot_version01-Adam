"use client";

type AdminStepUpModalProps = {
  open: boolean;
  secureToken: string;
  isSubmitting: boolean;
  onSecureTokenChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
};

export function AdminStepUpModal({
  open,
  secureToken,
  isSubmitting,
  onSecureTokenChange,
  onCancel,
  onConfirm,
  title = "การยืนยันตัวตนระดับรักษาความปลอดภัยสากล",
  description = "กรุณากรอกรหัสความปลอดภัยชั่วคราว 6 หลัก จากแอปพลิเคชัน Google Authenticator เพื่อยืนยันและอนุมัติการเปลี่ยนแปลง",
}: AdminStepUpModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 border border-zinc-200 shadow-xl space-y-4">
        <div className="text-center">
          <span className="text-3xl block mb-2">🔒</span>
          <h3 className="text-sm font-bold text-zinc-900">{title}</h3>
          <p className="text-xs text-zinc-500 mt-1">{description}</p>
        </div>

        <input
          type="text"
          inputMode="numeric"
          maxLength={6}
          placeholder="000000"
          className="w-full text-center tracking-[0.5em] text-lg font-bold border border-zinc-300 rounded-xl py-3 focus:outline-none focus:ring-2 focus:ring-blue-600 font-mono"
          value={secureToken}
          onChange={(event) =>
            onSecureTokenChange(event.target.value.replace(/\D/g, "").slice(0, 6))
          }
        />

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="flex-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-medium py-2.5 rounded-xl transition-colors disabled:opacity-50"
          >
            ยกเลิกรายการ
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={secureToken.length !== 6 || isSubmitting}
            className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold py-2.5 rounded-xl transition-colors disabled:opacity-50"
          >
            {isSubmitting ? "กำลังตรวจสอบรหัสความปลอดภัย..." : "🛡️ ยืนยันบันทึกข้อมูล"}
          </button>
        </div>
      </div>
    </div>
  );
}
