import mongoose from "mongoose";

type MongooseCache = { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null };
declare global { var _mongoose: MongooseCache | undefined; }
const cached: MongooseCache = global._mongoose ?? (global._mongoose = { conn: null, promise: null });

export default async function dbConnect() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is not set");
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose.connect(uri, { bufferCommands: false }).then((m) => m);
  }
  cached.conn = await cached.promise;
  return cached.conn;
}
