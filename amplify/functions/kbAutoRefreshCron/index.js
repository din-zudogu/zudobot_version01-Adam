/**
 * AWS Lambda — Knowledge Base Auto-Refresh Cron
 *
 * Triggered by an AWS EventBridge rule: rate(1 hour)
 * (the per-tenant interval, e.g. every 6h, is read from the DB — so changing
 *  cadence never requires touching this Lambda or the schedule).
 *
 * Environment variables required:
 *   - APP_URL               e.g. https://zudobot.zudogu.com
 *   - INTERNAL_CRON_SECRET  (same value as the Next.js env var)
 *
 * One-time setup (AWS Console or Amplify CLI), mirroring dailyCheckCron:
 *   amplify add function --name kbAutoRefreshCron
 *   (select Lambda trigger → EventBridge rule → rate(1 hour))
 *   Then set APP_URL + INTERNAL_CRON_SECRET on the function.
 */

const https = require("https");
const http  = require("http");
const url   = require("url");

exports.handler = async () => {
  const appUrl = process.env.APP_URL;
  const secret = process.env.INTERNAL_CRON_SECRET;

  if (!appUrl || !secret) {
    console.error("[kbAutoRefreshCron] Missing APP_URL or INTERNAL_CRON_SECRET");
    return { statusCode: 500, body: "missing_env" };
  }

  const endpoint = `${appUrl}/api/cron/kb-auto-refresh`;
  console.log("[kbAutoRefreshCron] Calling", endpoint);

  try {
    const result = await callEndpoint(endpoint, secret);
    console.log("[kbAutoRefreshCron] Result:", result);
    return { statusCode: 200, body: result };
  } catch (err) {
    console.error("[kbAutoRefreshCron] Error:", err.message);
    return { statusCode: 500, body: err.message };
  }
};

function callEndpoint(endpoint, secret) {
  return new Promise((resolve, reject) => {
    const parsed  = url.parse(endpoint);
    const driver  = parsed.protocol === "https:" ? https : http;
    const body    = JSON.stringify({});
    const options = {
      hostname: parsed.hostname,
      port:     parsed.port ?? (parsed.protocol === "https:" ? 443 : 80),
      path:     parsed.path,
      method:   "POST",
      headers:  {
        "x-cron-secret":  secret,
        "Content-Type":   "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
      // The route does bounded work (~22s) but allow generous socket time.
      timeout: 70_000,
    };

    const req = driver.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end",  () => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(data);
        else reject(new Error(`HTTP ${res.statusCode}: ${data}`));
      });
    });

    req.on("timeout", () => req.destroy(new Error("request_timeout")));
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}
