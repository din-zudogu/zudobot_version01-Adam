#!/usr/bin/env node
/**
 * Ensures zudobot.zudogu.com is allowed for the marketing-site widget embed key.
 *
 * Usage (from repo root, AWS credentials for Amplify API):
 *   node scripts/ensure-site-widget-domain.mjs
 *   node scripts/ensure-site-widget-domain.mjs --key=4cd9beb1aca36902c7fa9ca0c7d04686
 */
import mongoose from "mongoose";
import { connectMongoose, loadMongoEnv } from "./lib/mongo-connect.mjs";

const DEFAULT_KEY = "4cd9beb1aca36902c7fa9ca0c7d04686";
const SITE_DOMAIN = "zudobot.zudogu.com";

function parseKey() {
  const arg = process.argv.find((a) => a.startsWith("--key="));
  return arg ? arg.slice("--key=".length) : DEFAULT_KEY;
}

const TenantProfileSchema = new mongoose.Schema(
  {
    tenantId: String,
    embedKey: String,
    allowedDomains: [String],
    allowedDomain: String,
    widgetEnabled: Boolean,
  },
  { collection: "tenantprofiles", strict: false }
);

async function main() {
  await loadMongoEnv();
  await connectMongoose();
  const embedKey = parseKey();
  const TenantProfile = mongoose.model("TenantProfile", TenantProfileSchema);
  const profile = await TenantProfile.findOne({ embedKey });

  if (!profile) {
    console.error(`No TenantProfile for embedKey=${embedKey}`);
    process.exit(1);
  }

  const domains = [...(profile.allowedDomains ?? [])];
  if (!domains.map((d) => d.toLowerCase().replace(/^www\./, "")).includes(SITE_DOMAIN)) {
    domains.push(SITE_DOMAIN);
    profile.allowedDomains = domains;
  }
  if (!profile.allowedDomain) {
    profile.allowedDomain = SITE_DOMAIN;
  }
  profile.widgetEnabled = true;
  await profile.save();

  console.log("OK:", {
    embedKey,
    tenantId: profile.tenantId,
    allowedDomains: profile.allowedDomains,
    widgetEnabled: profile.widgetEnabled,
  });
  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
