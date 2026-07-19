const statusEl = document.getElementById("status");

function setStatus(text) {
  statusEl.textContent = text;
}

document.getElementById("btn-signin").addEventListener("click", () => {
  setStatus("กำลังล็อกอิน...");
  chrome.runtime.sendMessage({ type: "ZUDOBOT_GOOGLE_SIGN_IN" }, (res) => {
    if (res?.ok) {
      setStatus(`เข้าสู่ระบบแล้ว (${res.email ?? "OK"})`);
    } else {
      setStatus(res?.error ?? "ล็อกอินไม่สำเร็จ");
    }
  });
});

document.getElementById("btn-inject").addEventListener("click", async () => {
  setStatus("กำลังฝังสคริปต์...");
  chrome.runtime.sendMessage({ type: "ZUDOBOT_INJECT_ACTIVE_TAB" }, (res) => {
    if (res?.ok) {
      setStatus("ติดตั้งสำเร็จบนแท็บนี้");
    } else if (res?.error === "oauth_required") {
      setStatus("กรุณาเข้าสู่ระบบก่อน หรือเชื่อมต่อจากแดชบอร์ด");
    } else {
      setStatus(res?.error ?? res?.message ?? "ฝังไม่สำเร็จ");
    }
  });
});

chrome.identity.getAuthToken({ interactive: false }, (token) => {
  if (token) setStatus("พร้อมฝังสคริปต์ (ล็อกอินแล้ว)");
});
