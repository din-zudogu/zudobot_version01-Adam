/**
 * ZUDOBOT Iframe Loader — v2 (3-Layer Defense)
 *
 * Drop-in snippet for full CSS/JS isolation via iframe.
 *
 * Usage (paste before </body>):
 *
 *   <script
 *     src="https://cdn.zudogu.com/zudobot/v1/zudobot-loader.js"
 *     data-key="YOUR_EMBED_KEY"
 *     data-color="#1E5BC6"
 *     data-position="bottom-right"
 *     defer
 *   ></script>
 *
 * Programmatic control:
 *   window.ZudobotLoader.open()
 *   window.ZudobotLoader.close()
 */

(function () {
  // Guard against double-load
  if ((window as Window & { _zdLoaded?: boolean })._zdLoaded) return;
  (window as Window & { _zdLoaded?: boolean })._zdLoaded = true;

  // ── Read config from script tag synchronously (currentScript is only
  //    available at parse time, not inside async callbacks) ──────────
  const script =
    (document.currentScript as HTMLScriptElement | null) ??
    (document.querySelector("script[data-key]") as HTMLScriptElement | null);

  if (!script) {
    console.warn("[ZudobotLoader] Cannot find script tag with data-key.");
    return;
  }

  const embedKey = script.getAttribute("data-key");
  if (!embedKey) {
    console.warn("[ZudobotLoader] data-key attribute is required.");
    return;
  }

  const embedUrl = (
    script.getAttribute("data-embed-url") ?? "https://zudobot.zudogu.com"
  ).replace(/\/$/, "");

  const color    = script.getAttribute("data-color")    ?? "#1E5BC6";
  const position = script.getAttribute("data-position") ?? "bottom-right";
  const side     = position === "bottom-left" ? "left" : "right";

  // ── Shared iframe reference (created after verify) ────────────────
  let iframe: HTMLIFrameElement | null = null;

  // ── Layer 1: Pre-flight domain verification ───────────────────────
  // Calls /api/embed/verify with the current page origin.
  // Response is browser-cached (max-age=300) — no latency after first load.
  // Fails open only if the network request itself errors, to avoid breaking
  // legitimate use on misconfigured networks.
  async function verifyDomain(): Promise<boolean> {
    try {
      const origin = encodeURIComponent(window.location.origin);
      const url    = `${embedUrl}/api/embed/verify?key=${encodeURIComponent(embedKey!)}&origin=${origin}`;
      const res    = await fetch(url, { method: "GET" });
      if (!res.ok) return false;
      const data   = await res.json() as { allowed?: boolean };
      return data.allowed === true;
    } catch {
      // Network error — fail open so legitimate sites don't go dark
      console.warn("[ZudobotLoader] Verify request failed, loading widget anyway.");
      return true;
    }
  }

  // ── Create and mount the iframe ───────────────────────────────────
  function mountIframe() {
    const params = new URLSearchParams({
      key:   embedKey!,
      color: color,
      pos:   position === "bottom-left" ? "left" : "right",
    });

    iframe         = document.createElement("iframe");
    iframe.id      = "zudobot-iframe";
    iframe.src     = `${embedUrl}/embed?${params.toString()}`;
    iframe.setAttribute("scrolling", "no");
    iframe.setAttribute("allow",     "");
    iframe.style.cssText = [
      "position: fixed",
      "bottom: 20px",
      side + ": 20px",
      "width: 68px",
      "height: 68px",
      "border: none",
      "z-index: 2147483647",
      "background: transparent",
      "transition: width 0.25s ease, height 0.25s ease",
      "overflow: hidden",
      "color-scheme: light",
    ].join("; ") + ";";

    document.body.appendChild(iframe);

    // ── postMessage bridge: iframe → parent (resize) ─────────────────
    window.addEventListener("message", function (event) {
      if (!iframe || event.source !== iframe.contentWindow) return;
      if (event.data === "zudobot:open") {
        iframe.style.width  = "390px";
        iframe.style.height = "620px";
      } else if (event.data === "zudobot:close") {
        iframe.style.width  = "68px";
        iframe.style.height = "68px";
      }
    });
  }

  // ── Orchestrate: verify → mount ───────────────────────────────────
  async function init() {
    const allowed = await verifyDomain();
    if (!allowed) {
      console.error(
        `[ZudobotLoader] Domain "${window.location.origin}" is not whitelisted for this embed key. ` +
        "Please add it in your Zudobot Dashboard → Settings → Widget Domains."
      );
      return;
    }
    mountIframe();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    void init();
  }

  // ── Programmatic API (parent → iframe) ───────────────────────────
  (window as Window & { ZudobotLoader?: { open(): void; close(): void } }).ZudobotLoader = {
    open()  { iframe?.contentWindow?.postMessage("zudobot:cmd:open",  "*"); },
    close() { iframe?.contentWindow?.postMessage("zudobot:cmd:close", "*"); },
  };
})();
