import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const PLATFORM_EMBED_LOADER = `(function(){
  var script = document.currentScript || document.querySelector("script[data-embed-key]");
  if (!script) {
    console.warn("[Zudobot] Cannot find embed script tag.");
    return;
  }
  var embedKey = script.getAttribute("data-embed-key");
  if (!embedKey) {
    console.warn("[Zudobot] data-embed-key is required.");
    return;
  }
  var apiUrl = (script.getAttribute("data-api-url") || "").replace(/\\/$/, "");
  if (!apiUrl) {
    try {
      apiUrl = new URL(script.src).origin;
    } catch (e) {
      console.warn("[Zudobot] data-api-url is required when script origin is unavailable.");
      return;
    }
  }
  var position = script.getAttribute("data-position") || "bottom-right";
  fetch(apiUrl + "/api/public/zudobot/widget-init?embedKey=" + encodeURIComponent(embedKey), {
    method: "GET",
    credentials: "omit",
    headers: { Accept: "application/json" }
  })
    .then(function(res) {
      if (!res.ok) {
        return res.json().catch(function() { return {}; }).then(function(body) {
          throw new Error(body.error || ("Security gate blocked (" + res.status + ")"));
        });
      }
      return res.json();
    })
    .then(function(payload) {
      if (!payload || !payload.success || !payload.settings) {
        throw new Error("Invalid widget configuration response.");
      }
      var settings = payload.settings;
      window.__ZUDOBOT_GLOBAL_EMBED__ = {
        embedKey: embedKey,
        apiUrl: apiUrl,
        settings: settings,
        position: position
      };
      var runtimeScript = document.createElement("script");
      runtimeScript.src = apiUrl + "/api/public/zudobot/embed-runtime.js";
      runtimeScript.defer = true;
      document.head.appendChild(runtimeScript);
    })
    .catch(function(err) {
      console.warn("[Zudobot] Platform embed blocked:", err && err.message ? err.message : err);
    });
})();`;

export async function GET() {
  return new NextResponse(PLATFORM_EMBED_LOADER, {
    status: 200,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
