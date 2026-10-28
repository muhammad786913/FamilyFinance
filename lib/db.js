import mongoose from "mongoose";

const g = globalThis;
if (!g._mongoose) g._mongoose = { conn: null, promise: null };

export async function connectDb() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not configured");
  if (g._mongoose.conn) return g._mongoose.conn;
  if (!g._mongoose.promise) {
    g._mongoose.promise = mongoose
      .connect(uri, {
        maxPoolSize: 20,
        serverSelectionTimeoutMS: 8000,
      })
      .catch((err) => {
        // Do not cache a failed connection: the next request should retry.
        g._mongoose.promise = null;
        g._mongoose.conn = null;
        throw err;
      });
  }
  g._mongoose.conn = await g._mongoose.promise;
  return g._mongoose.conn;
}

export async function disconnectDb() {
  if (g._mongoose.conn) {
    await mongoose.disconnect();
    g._mongoose.conn = null;
    g._mongoose.promise = null;
  }
}
