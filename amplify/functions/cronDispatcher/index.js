/**
 * cronDispatcher — one Lambda that calls a zudobot cron endpoint.
 *
 * EventBridge invokes it with a constant input that names the endpoint, e.g.
 *   { "path": "/api/cron/delete-tenant" }
 * so a SINGLE Lambda can back every schedule (one EventBridge rule per cron, all
 * targeting this function with a different `path`). Config comes from the Lambda's
 * own env (APP_URL, INTERNAL_CRON_SECRET) — set once on the function.
 *
 * Runtime: nodejs20.x (global fetch). Handler: index.handler
 */
exports.handler = async (event) => {
  const appUrl = process.env.APP_URL;
  const secret = process.env.INTERNAL_CRON_SECRET;
  if (!appUrl || !secret) {
    throw new Error("Lambda env APP_URL and INTERNAL_CRON_SECRET must be set");
  }

  const path = event && event.path;
  if (!path) {
    throw new Error('event.path is required — set the EventBridge target input to {"path":"/api/cron/..."}');
  }
  const method = (event && event.method) || "POST";
  const url = appUrl.replace(/\/+$/, "") + path;

  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      // Routes accept either header style — send both to cover all of them.
      "x-cron-secret": secret,
      Authorization: "Bearer " + secret,
    },
  });

  const body = await res.text();
  const result = { path, status: res.status, ok: res.ok, body: body.slice(0, 500) };
  console.log("[cronDispatcher]", JSON.stringify(result));

  if (!res.ok) {
    throw new Error(`cron ${path} failed: HTTP ${res.status} — ${body.slice(0, 200)}`);
  }
  return result;
};
