/**
 * ZUDOBOT Widget — Self-initializing embed script
 *
 * Embed on any website with ONE script tag:
 *   <script
 *     src="https://cdn.zudogu.com/zudobot/v1/widget.js"
 *     data-key="YOUR_EMBED_KEY"
 *     data-color="#1E5BC6"
 *     data-position="bottom-right"
 *     defer
 *   ></script>
 *
 * Programmatic control:
 *   window.Zudobot.open()
 *   window.Zudobot.close()
 */

import { ZudobotWidget } from "./Widget";
import { resolveWidgetApiOrigin } from "./resolveApiOrigin";

function autoInit() {
  const script =
    (document.currentScript as HTMLScriptElement | null) ??
    (document.querySelector("script[data-key]") as HTMLScriptElement | null);

  if (!script) {
    console.warn("[Zudobot] Cannot find script tag with data-key.");
    return;
  }

  const embedKey = script.getAttribute("data-key");
  if (!embedKey) {
    console.warn("[Zudobot] data-key is required.");
    return;
  }

  const apiUrl   = resolveWidgetApiOrigin(script.getAttribute("data-api-url"));
  const color    = script.getAttribute("data-color")    ?? "#1E5BC6";
  const position = (script.getAttribute("data-position") ?? "bottom-right") as "bottom-right" | "bottom-left";

  const widget = new ZudobotWidget({ embedKey, apiUrl, color, position });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => widget.init());
  } else {
    widget.init();
  }

  (window as typeof window & { Zudobot?: ZudobotWidget }).Zudobot = widget;
}

autoInit();
