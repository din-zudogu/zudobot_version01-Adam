import mongoose from "mongoose";
import dns from "dns";
import { encodeMongoUri, parseMongoCredentials } from "@/lib/db/mongoUri";
import { requireAmplifyEnv } from "@/lib/env/amplifyGuardrail";

if (
  process.env.MONGO_DNS_SERVERS &&
  process.env.MONGO_DNS_SERVERS !== "system"
) {
  dns.setServers(
    process.env.MONGO_DNS_SERVERS.split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
} else if (process.platform === "win32" && process.env.MONGO_DNS_SERVERS !== "system") {
  dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
}

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

const globalWithCache = global as typeof globalThis & {
  mongooseCache?: MongooseCache;
};

const cache: MongooseCache = globalWithCache.mongooseCache ?? { conn: null, promise: null };
globalWithCache.mongooseCache = cache;

const DB_NAME = "zudobot_saas";

async function openConnection(): Promise<typeof mongoose> {
  const srv = requireAmplifyEnv("MONGO_URI");
  const direct = process.env.MONGO_URI_DIRECT?.trim() || undefined;
  const errors: string[] = [];

  if (srv) {
    try {
      const conn = await mongoose.connect(encodeMongoUri(srv), {
        dbName: DB_NAME,
        bufferCommands: false,
        serverSelectionTimeoutMS: 12_000,
      });
      return conn;
    } catch (err) {
      errors.push(`SRV: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (direct) {
    try {
      const encoded = encodeMongoUri(direct);
      const conn = await mongoose.connect(encoded, {
        dbName: DB_NAME,
        bufferCommands: false,
        serverSelectionTimeoutMS: 12_000,
      });
      return conn;
    } catch (err) {
      errors.push(`DIRECT-uri: ${err instanceof Error ? err.message : String(err)}`);
    }

    try {
      const { uriWithoutCreds, username, password } = parseMongoCredentials(direct);
      const conn = await mongoose.connect(uriWithoutCreds, {
        dbName: DB_NAME,
        bufferCommands: false,
        user: username,
        pass: password,
        authSource: "admin",
        serverSelectionTimeoutMS: 12_000,
      });
      return conn;
    } catch (err) {
      errors.push(`DIRECT-auth: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  throw new Error(
    errors.length
      ? `MongoDB connect failed: ${errors.join(" | ")}`
      : "MONGO_URI environment variable is not defined"
  );
}

export async function connectDB(): Promise<typeof mongoose> {
  if (cache.conn) return cache.conn;

  if (!cache.promise) {
    cache.promise = openConnection().catch((err) => {
      cache.promise = null;
      throw err;
    });
  }

  cache.conn = await cache.promise;
  return cache.conn;
}

/** For diagnostics — ping without caching failures permanently */
export async function pingMongoDB(): Promise<{ ok: boolean; error?: string }> {
  try {
    const conn = await connectDB();
    await conn.connection.db!.admin().ping();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
