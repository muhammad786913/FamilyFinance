import { connectDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const conn = await connectDb();
    // Actually round-trip to MongoDB; readyState alone can be stale.
    await conn.connection.db.admin().ping();
    return Response.json({ ok: true, db: "connected" });
  } catch {
    return Response.json({ ok: false, db: "unavailable" }, { status: 503 });
  }
}
