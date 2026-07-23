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
    void signInAndFetchConfig(true).then((config) => {
      sendResponse({ success: config.ok === true, ...config });
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
    void signInAndFetchConfig(true).then(sendResponse);
    return true;
  }

  if (message?.type === "ZUDOBOT_INJECT_ACTIVE_TAB") {
    void injectOnActiveTab().then(sendResponse);
    return true;
  }

  return false;
});

function getAuthTokenAsync(interactive) {
  return new Promise((resolve) => {
    chrome.identity.getAuthToken({ interactive }, (token) => {
      // Swallow lastError here — callers treat a falsy token as "no token"
      // and chrome.runtime.lastError must still be read to avoid an
      // "Unchecked runtime.lastError" warning in the service worker console.
      void chrome.runtime.lastError;
      resolve(token ?? null);
    });
  });
}

function removeCachedAuthToken(token) {
  return new Promise((resolve) => {
    if (!token) return resolve();
    chrome.identity.removeCachedAuthToken({ token }, () => resolve());
  });
}

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

/**
 * Get a Google token and exchange it for the Zudobot session/widget config.
 * If the server rejects the token (e.g. a stale cached token left over from
 * a previous OAuth client_id), drop the cached copy and retry once with a
 * fresh interactive consent — Chrome otherwise keeps handing out the same
 * invalid token indefinitely via getAuthToken({interactive:false}).
 */
async function signInAndFetchConfig(interactive) {
  const token = await getAuthTokenAsync(interactive);
  if (!token) return { ok: false, error: "no_google_token" };

  const first = await fetchWidgetConfiguration(token);
  if (first.ok) return first;

  await removeCachedAuthToken(token);
  const retryToken = await getAuthTokenAsync(true);
  if (!retryToken) return first;
  if (retryToken === token) return first;

  return fetchWidgetConfiguration(retryToken);
}

async function runDashboardInject() {
  const stored = await chrome.storage.session.get(["zudobot_embed_script"]);
  if (!stored.zudobot_embed_script) {
    const config = await signInAndFetchConfig(true);
    if (!config.ok) return { success: false, error: config.error ?? "oauth_failed" };
  }

  const injected = await injectOnActiveTab();
  return { success: injected.ok === true, ...injected };
}

async function injectOnActiveTab() {
  const stored = await chrome.storage.session.get(["zudobot_embed_script"]);
  let embedScript = stored.zudobot_embed_script;
  let lastError = "oauth_required";

  if (!embedScript) {
    const config = await signInAndFetchConfig(false);
    embedScript = config.embedScript;
    if (!config.ok) lastError = config.error ?? "config_failed";
  }

  if (!embedScript) {
    return { ok: false, error: lastError };
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
