/** @see config.js */
const API_BASE = "https://zudobot.zudogu.com";
const EXTENSION_VERSION = "1.0.0";

chrome.runtime.onMessageExternal.addListener((message, _sender, sendResponse) => {
  if (
    message?.action === "CHECK_EXTENSION_INSTALLED" ||
    message?.action === "CHECK_ZUDOBOT_EXTENSION"
  ) {
    sendResponse({ installed: true, status: "ACTIVE", version: EXTENSION_VERSION });
    return;
  }

  if (message?.action === "INJECT_WIDGET_SCRIPT") {
    void runDashboardInject().then(sendResponse);
    return true;
  }

  if (message?.action === "TRIGGER_OAUTH") {
    chrome.identity.getAuthToken({ interactive: true }, async (googleToken) => {
      if (chrome.runtime.lastError) {
        sendResponse({
          success: false,
          error: chrome.runtime.lastError.message ?? "google_auth_failed",
        });
        return;
      }
      if (!googleToken) {
        sendResponse({ success: false, error: "no_google_token" });
        return;
      }

      const config = await fetchWidgetConfiguration(googleToken);
      sendResponse({
        success: config.ok === true,
        ...config,
      });
    });
    return true;
  }

  if (message?.action === "GET_EMBED_SCRIPT") {
    void chrome.storage.session
      .get(["zudobot_embed_script"])
      .then((data) => {
        sendResponse({
          ok: !!data.zudobot_embed_script,
          embedScript: data.zudobot_embed_script ?? "",
        });
      });
    return true;
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "ZUDOBOT_GOOGLE_SIGN_IN") {
    chrome.identity.getAuthToken({ interactive: true }, async (googleToken) => {
      if (chrome.runtime.lastError || !googleToken) {
        sendResponse({
          ok: false,
          error: chrome.runtime.lastError?.message ?? "no_google_token",
        });
        return;
      }
      sendResponse(await fetchWidgetConfiguration(googleToken));
    });
    return true;
  }

  if (message?.type === "ZUDOBOT_INJECT_ACTIVE_TAB") {
    void injectOnActiveTab().then(sendResponse);
    return true;
  }

  return false;
});

async function fetchWidgetConfiguration(googleAccessToken) {
  const res = await fetch(`${API_BASE}/api/integration/extension/google-session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ googleAccessToken }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    return {
      ok: false,
      error: data.error ?? data.message ?? "widget_config_failed",
      status: res.status,
    };
  }

  if (data.accessToken) {
    await chrome.storage.session.set({
      zudobot_oauth_token: data.accessToken,
      zudobot_embed_script: data.embedScript ?? "",
      zudobot_tenant_id: data.tenantId ?? "",
    });
  }

  return {
    ok: true,
    email: data.email,
    accessToken: data.accessToken,
    embedScript: data.embedScript,
    tenantId: data.tenantId,
  };
}

async function runDashboardInject() {
  const token = await new Promise((resolve) => {
    chrome.identity.getAuthToken({ interactive: false }, resolve);
  });
  if (!token) {
    const oauth = await new Promise((resolve) => {
      chrome.identity.getAuthToken({ interactive: true }, resolve);
    });
    if (!oauth) {
      return { success: false, error: "oauth_required" };
    }
    const config = await fetchWidgetConfiguration(oauth);
    if (!config.ok) return { success: false, error: config.error ?? "oauth_failed" };
  } else {
    const stored = await chrome.storage.session.get(["zudobot_embed_script"]);
    if (!stored.zudobot_embed_script) {
      const config = await fetchWidgetConfiguration(token);
      if (!config.ok) return { success: false, error: config.error ?? "config_failed" };
    }
  }

  const injected = await injectOnActiveTab();
  return { success: injected.ok === true, ...injected };
}

async function injectOnActiveTab() {
  const stored = await chrome.storage.session.get(["zudobot_embed_script"]);
  let embedScript = stored.zudobot_embed_script;

  if (!embedScript) {
    const token = await new Promise((resolve) => {
      chrome.identity.getAuthToken({ interactive: false }, resolve);
    });
    if (token) {
      const config = await fetchWidgetConfiguration(token);
      embedScript = config.embedScript;
    }
  }

  if (!embedScript) {
    return { ok: false, error: "oauth_required" };
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return { ok: false, error: "no_active_tab" };

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: (html) => {
      if (document.querySelector('script[data-tenant-id], script[data-key]')) return;
      const tpl = document.createElement("template");
      tpl.innerHTML = html.trim();
      const el = tpl.content.firstChild;
      if (el) document.head.appendChild(el);
    },
    args: [embedScript],
  });

  return { ok: true, message: "ติดตั้ง Zudobot บนแท็บนี้แล้ว" };
}
