/**
 * MongoDB connection for standalone scripts.
 * Env: AWS Amplify only (see loadAmplifyEnv.mjs) — no local .env files.
 */

import dns from "node:dns";
import { promisify } from "node:util";
import { MongoClient } from "mongodb";
import mongoose from "mongoose";
import { applyAwsCredentialAliases, loadAmplifyEnv } from "./loadAmplifyEnv.mjs";

const DB_NAME = process.env.MONGO_DB_NAME || "zudobot_saas";
const resolveSrv = promisify(dns.resolveSrv);

let dnsConfigured = false;
let envLoaded = false;

export function configureMongoDns() {
  if (dnsConfigured) return;
  dnsConfigured = true;
  const custom = process.env.MONGO_DNS_SERVERS?.trim();
  if (custom === "system" || custom === "default") return;
  if (custom) {
    dns.setServers(custom.split(",").map((s) => s.trim()).filter(Boolean));
    return;
  }
  if (process.platform === "win32") {
    dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
  }
}

/** Load MONGO_* from AWS Amplify (never from local files). */
export async function loadMongoEnv() {
  if (envLoaded) return;
  configureMongoDns();
  applyAwsCredentialAliases();
  const meta = await loadAmplifyEnv({
    keys: ["MONGO_URI", "MONGO_URI_DIRECT", "MONGO_DB_NAME"],
  });
  if (meta.vars.MONGO_DB_NAME) {
    process.env.MONGO_DB_NAME = meta.vars.MONGO_DB_NAME;
  }
  envLoaded = true;
  return meta;
}

export function encodeMongoUri(uri) {
  const schemeMatch = uri.match(/^(mongodb(?:\+srv)?:\/\/)/);
  if (!schemeMatch) return uri;
  const scheme = schemeMatch[1];
  const rest = uri.slice(scheme.length);
  const lastAt = rest.lastIndexOf("@");
  if (lastAt === -1) return uri;
  const credentials = rest.slice(0, lastAt);
  const hostAndMore = rest.slice(lastAt + 1);
  const firstColon = credentials.indexOf(":");
  if (firstColon === -1) return uri;
  const user = credentials.slice(0, firstColon);
  const password = credentials.slice(firstColon + 1);
  return `${scheme}${user}:${encodeURIComponent(password)}@${hostAndMore}`;
}

export function parseMongoCredentials(uri) {
  const schemeMatch = uri.match(/^(mongodb(?:\+srv)?:\/\/)/);
  if (!schemeMatch) throw new Error("Invalid MONGO_URI");
  const scheme = schemeMatch[1];
  const rest = uri.slice(scheme.length);
  const lastAt = rest.lastIndexOf("@");
  if (lastAt === -1) throw new Error("MONGO_URI missing credentials");
  const credentials = rest.slice(0, lastAt);
  const hostAndMore = rest.slice(lastAt + 1);
  const firstColon = credentials.indexOf(":");
  if (firstColon === -1) throw new Error("MONGO_URI missing password");
  return {
    scheme,
    username: credentials.slice(0, firstColon),
    password: credentials.slice(firstColon + 1),
    hostAndMore,
    uriWithoutCreds: `${scheme}${hostAndMore}`,
  };
}

export function buildDirectUriFromTemplates(srvUri, directTemplate) {
  const srv = parseMongoCredentials(srvUri);
  const direct = parseMongoCredentials(directTemplate);
  const hosts = direct.hostAndMore.split("?")[0];
  const qs = direct.hostAndMore.includes("?") ? direct.hostAndMore.split("?")[1] : "ssl=true&authSource=admin";
  return `mongodb://${encodeURIComponent(srv.username)}:${encodeURIComponent(srv.password)}@${hosts}?${qs}`;
}

export async function buildUriFromSrvLookup(srvUri, directTemplate) {
  configureMongoDns();
  const srv = parseMongoCredentials(srvUri);
  const clusterHost = srv.hostAndMore.split("/")[0].split("?")[0];
  const records = await resolveSrv(`_mongodb._tcp.${clusterHost}`);
  const seeds = records.map((r) => `${r.name}:${r.port}`).join(",");
  const direct = directTemplate ? parseMongoCredentials(directTemplate) : null;
  const qs =
    direct?.hostAndMore?.includes("?")
      ? direct.hostAndMore.split("?")[1]
      : "ssl=true&authSource=admin&replicaSet=atlas-kj716r-shard-0";
  return `mongodb://${encodeURIComponent(srv.username)}:${encodeURIComponent(srv.password)}@${seeds}/?${qs}`;
}

export function getMongoEnvSummary() {
  const srv = process.env.MONGO_URI;
  const direct = process.env.MONGO_URI_DIRECT;
  if (!srv && !direct) return { ok: false, error: "MONGO_URI not set (load Amplify env first)" };
  const parsed = parseMongoCredentials(direct || srv);
  return {
    ok: true,
    user: parsed.username,
    passwordLength: parsed.password.length,
    srvHost: srv ? parseMongoCredentials(srv).hostAndMore.split("/")[0].split("?")[0] : null,
    directHost: direct ? parseMongoCredentials(direct).hostAndMore.split("/")[0].split("?")[0] : null,
  };
}

function getDbName() {
  return process.env.MONGO_DB_NAME || DB_NAME;
}

async function tryConnect(label, connectFn) {
  try {
    return { ok: true, ...(await connectFn()) };
  } catch (err) {
    return { ok: false, label, error: formatMongoError(err) };
  }
}

export async function connectMongoClient() {
  await loadMongoEnv();
  const dbName = getDbName();
  const srv = process.env.MONGO_URI;
  const direct = process.env.MONGO_URI_DIRECT;
  const errors = [];

  if (srv) {
    const r1 = await tryConnect("SRV", async () => {
      const client = new MongoClient(encodeMongoUri(srv), { serverSelectionTimeoutMS: 15_000 });
      await client.connect();
      await client.db(dbName).command({ ping: 1 });
      return { client, mode: "Amplify MONGO_URI (srv)" };
    });
    if (r1.ok) return r1;
    errors.push(`SRV: ${r1.error}`);

    const r2 = await tryConnect("SRV-manual", async () => {
      const uri = await buildUriFromSrvLookup(srv, direct);
      const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15_000 });
      await client.connect();
      await client.db(dbName).command({ ping: 1 });
      return { client, mode: "Amplify MONGO_URI (manual SRV resolve)" };
    });
    if (r2.ok) return r2;
    errors.push(`SRV-manual: ${r2.error}`);
  }

  if (direct) {
    const r3 = await tryConnect("DIRECT-uri", async () => {
      const client = new MongoClient(encodeMongoUri(direct), { serverSelectionTimeoutMS: 15_000 });
      await client.connect();
      await client.db(dbName).command({ ping: 1 });
      return { client, mode: "Amplify MONGO_URI_DIRECT (encoded URI)" };
    });
    if (r3.ok) return r3;
    errors.push(`DIRECT-uri: ${r3.error}`);

    const { uriWithoutCreds, username, password } = parseMongoCredentials(direct);
    const r4 = await tryConnect("DIRECT-auth", async () => {
      const client = new MongoClient(uriWithoutCreds, {
        auth: { username, password },
        authSource: "admin",
        serverSelectionTimeoutMS: 15_000,
      });
      await client.connect();
      await client.db(dbName).command({ ping: 1 });
      return { client, mode: "Amplify MONGO_URI_DIRECT (split auth)" };
    });
    if (r4.ok) return r4;
    errors.push(`DIRECT-auth: ${r4.error}`);
  }

  throw new Error(
    `MongoDB connect failed (credentials from AWS Amplify).\n  ${errors.join("\n  ")}\n` +
      `  → ตรวจ MONGO_URI ใน Amplify Console → Environment variables (branch: ${process.env.AMPLIFY_BRANCH ?? "master"})`
  );
}

export async function connectMongoose() {
  await loadMongoEnv();
  const srv = process.env.MONGO_URI;
  if (!srv) throw new Error("MONGO_URI missing after Amplify load");
  await mongoose.connect(encodeMongoUri(srv), {
    dbName: getDbName(),
    serverSelectionTimeoutMS: 15_000,
  });
  return { mode: "mongoose + Amplify MONGO_URI" };
}

function formatMongoError(err) {
  const e = err;
  return [e.name, e.code, e.codeName, e.message?.split("\n")[0]].filter(Boolean).join(" ");
}
