const statusEl = document.getElementById("status");

function setStatus(text) {
  statusEl.textContent = text;
}

const SIGNIN_ERROR_MESSAGES = {
  account_not_found: "ไม่พบบัญชีนี้ในระบบ Zudobot — เข้าสู่ระบบด้วย Google ที่ผูกกับร้านของคุณ",
  role_not_allowed: "บัญชีนี้ไม่มีสิทธิ์ใช้งานตัวช่วยติดตั้ง",
  google_audience_mismatch: "ตัวช่วยติดตั้งยังตั้งค่าไม่ครบ (client ID ไม่ตรงกัน) — ติดต่อทีมงาน Zudobot",
  google_token_expired: "เซสชัน Google หมดอายุ กรุณาลองเข้าสู่ระบบใหม่",
  no_google_token: "กรุณาเข้าสู่ระบบ Google ก่อน",
};

document.getElementById("btn-signin").addEventListener("click", () => {
  setStatus("กำลังล็อกอิน...");
  chrome.runtime.sendMessage({ type: "ZUDOBOT_GOOGLE_SIGN_IN" }, (res) => {
    if (res?.ok) {
      setStatus(`เข้าสู่ระบบแล้ว (${res.email ?? "OK"})`);
    } else {
      setStatus(SIGNIN_ERROR_MESSAGES[res?.error] ?? res?.error ?? "ล็อกอินไม่สำเร็จ");
    }
  });
});

document.getElementById("btn-inject").addEventListener("click", async () => {
  setStatus("กำลังฝังสคริปต์...");
  chrome.runtime.sendMessage({ type: "ZUDOBOT_INJECT_ACTIVE_TAB" }, (res) => {
    if (res?.ok) {
      setStatus("ติดตั้งสำเร็จบนแท็บนี้");
    } else if (res?.error === "oauth_required" || res?.error === "no_google_token") {
      setStatus("กรุณาเข้าสู่ระบบก่อน หรือเชื่อมต่อจากแดชบอร์ด");
    } else if (res?.error === "account_not_found") {
      setStatus("ไม่พบบัญชีนี้ในระบบ Zudobot — เข้าสู่ระบบด้วย Google ที่ผูกกับร้านของคุณ");
    } else {
      setStatus(res?.error ?? res?.message ?? "ฝังไม่สำเร็จ");
    }
  });
});

chrome.identity.getAuthToken({ interactive: false }, (token) => {
  if (token) setStatus("พร้อมฝังสคริปต์ (ล็อกอินแล้ว)");
});
