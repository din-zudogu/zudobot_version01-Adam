export const UNSAVED_LEAVE_MESSAGE =
  "คุณยืนยันจะออกจากหน้าจอนี้หรือไม่ หากใช่กรุณาบันทึกข้อมูลก่อนออกจากหน้าจอ หากไม่บันทึกระบบจะไม่ได้เก็บข้อมูลล่าสุดที่อัพเดตไว้ให้";

export function confirmLeaveWhenDirty(isDirty: boolean): boolean {
  if (!isDirty) return true;
  return window.confirm(UNSAVED_LEAVE_MESSAGE);
}
