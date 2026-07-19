/**
 * AWS Lambda — Daily Check Cron
 *
 * Triggered by AWS EventBridge rule: rate(1 day) at 00:05 UTC
 * Environment variables required:
 *   - APP_URL            e.g. https://zudobot.zudogu.com
 *   - INTERNAL_CRON_SECRET  (same value as Next.js env var)
 *
 * Deploy via AWS Console or Amplify CLI:
 *   amplify add function --name dailyCheckCron
 *   (select Lambda trigger → EventBridge rule → rate(1 day))
 */

const https = require("https");
const http  = require("http");
const url   = require("url");

exports.handler = async (event) => {
  const appUrl = process.env.APP_URL;
  const secret = process.env.INTERNAL_CRON_SECRET;

  if (!appUrl || !secret) {
    console.error("[dailyCheckCron] Missing APP_URL or INTERNAL_CRON_SECRET");
    return { statusCode: 500, body: "missing_env" };
  }

  const endpoint = `${appUrl}/api/internal/daily-check`;
  console.log("[dailyCheckCron] Calling", endpoint);

  try {
    const result = await callEndpoint(endpoint, secret);
    console.log("[dailyCheckCron] Result:", result);
    return { statusCode: 200, body: result };
  } catch (err) {
    console.error("[dailyCheckCron] Error:", err.message);
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
        "Authorization":  `Bearer ${secret}`,
        "Content-Type":   "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    };

    const req = driver.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end",  () => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(data);
        else reject(new Error(`HTTP ${res.statusCode}: ${data}`));
      });
    });

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}
