import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const EMBED_RUNTIME = `(function(){
  var cfg = window.__ZUDOBOT_GLOBAL_EMBED__;
  if (!cfg || !cfg.embedKey || !cfg.apiUrl || !cfg.settings) return;

  var embedKey = cfg.embedKey;
  var apiUrl = cfg.apiUrl.replace(/\\/$/, "");
  var settings = cfg.settings;
  var position = cfg.position || "bottom-right";
  var color = settings.themeColor || "#3B82F6";
  var botName = settings.botName || "Zudobot";
  var welcome = settings.welcomeMessage || "สวัสดีครับ";

  var storageKey = "zudobot_global_session_" + embedKey;
  var sessionId = "";
  try {
    sessionId = localStorage.getItem(storageKey) || "";
    if (!sessionId) {
      sessionId = "g_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(storageKey, sessionId);
    }
  } catch (e) {
    sessionId = "g_" + Date.now();
  }

  var root = document.createElement("div");
  root.id = "zudobot-global-embed-root";
  root.style.cssText = "position:fixed;z-index:2147483000;font-family:system-ui,sans-serif;font-size:14px;";
  if (position.indexOf("left") >= 0) root.style.left = "20px"; else root.style.right = "20px";
  if (position.indexOf("top") >= 0) root.style.top = "20px"; else root.style.bottom = "20px";
  document.body.appendChild(root);

  var panelOpen = false;
  var panel = document.createElement("div");
  panel.style.cssText = "display:none;width:320px;max-width:calc(100vw - 40px);height:420px;max-height:calc(100vh - 100px);background:#fff;border-radius:16px;box-shadow:0 12px 40px rgba(0,0,0,.18);overflow:hidden;flex-direction:column;margin-bottom:12px;border:1px solid #e4e4e7;";
  root.appendChild(panel);

  var header = document.createElement("div");
  header.style.cssText = "background:" + color + ";color:#fff;padding:12px 14px;font-weight:700;font-size:13px;";
  header.textContent = botName;
  panel.appendChild(header);

  var messages = document.createElement("div");
  messages.style.cssText = "flex:1;overflow-y:auto;padding:12px;background:#fafafa;";
  panel.appendChild(messages);

  function addMsg(text, role) {
    var bubble = document.createElement("div");
    bubble.style.cssText = "margin-bottom:8px;max-width:88%;padding:8px 10px;border-radius:12px;font-size:13px;line-height:1.45;word-break:break-word;" +
      (role === "user" ? "margin-left:auto;background:" + color + ";color:#fff;" : "background:#fff;border:1px solid #e4e4e7;color:#18181b;");
    bubble.textContent = text;
    messages.appendChild(bubble);
    messages.scrollTop = messages.scrollHeight;
  }

  addMsg(welcome, "bot");

  var inputRow = document.createElement("div");
  inputRow.style.cssText = "display:flex;gap:6px;padding:10px;border-top:1px solid #e4e4e7;background:#fff;";
  var input = document.createElement("input");
  input.type = "text";
  input.placeholder = "พิมพ์ข้อความ...";
  input.style.cssText = "flex:1;border:1px solid #d4d4d8;border-radius:10px;padding:8px 10px;font-size:13px;outline:none;";
  var sendBtn = document.createElement("button");
  sendBtn.type = "button";
  sendBtn.textContent = "ส่ง";
  sendBtn.style.cssText = "background:" + color + ";color:#fff;border:none;border-radius:10px;padding:8px 12px;font-size:12px;font-weight:600;cursor:pointer;";
  inputRow.appendChild(input);
  inputRow.appendChild(sendBtn);
  panel.appendChild(inputRow);

  var launcher = document.createElement("button");
  launcher.type = "button";
  launcher.setAttribute("aria-label", "Open chat");
  launcher.style.cssText = "width:56px;height:56px;border-radius:50%;border:none;background:" + color + ";color:#fff;font-size:22px;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.2);display:flex;align-items:center;justify-content:center;margin-left:auto;";
  launcher.textContent = "💬";
  root.appendChild(launcher);

  panel.style.display = "flex";
  panel.style.flexDirection = "column";

  function togglePanel() {
    panelOpen = !panelOpen;
    panel.style.display = panelOpen ? "flex" : "none";
  }

  launcher.addEventListener("click", togglePanel);

  function sendMessage() {
    var text = (input.value || "").trim();
    if (!text) return;
    input.value = "";
    addMsg(text, "user");
    sendBtn.disabled = true;
    fetch(apiUrl + "/api/public/zudobot/chat", {
      method: "POST",
      credentials: "omit",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ key: embedKey, sessionId: sessionId, message: text })
    })
      .then(function(res) { return res.json().then(function(data) { return { res: res, data: data }; }); })
      .then(function(out) {
        if (!out.res.ok || !out.data || !out.data.ok) {
          throw new Error((out.data && out.data.error) || "chat_failed");
        }
        addMsg(out.data.reply || "ขออภัย ไม่สามารถตอบได้ในขณะนี้", "bot");
      })
      .catch(function() {
        addMsg("ขออภัย ระบบไม่สามารถตอบได้ในขณะนี้ กรุณาลองใหม่ภายหลัง", "bot");
      })
      .finally(function() { sendBtn.disabled = false; });
  }

  sendBtn.addEventListener("click", sendMessage);
  input.addEventListener("keydown", function(e) {
    if (e.key === "Enter") sendMessage();
  });
})();`;

export async function GET() {
  return new NextResponse(EMBED_RUNTIME, {
    status: 200,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
