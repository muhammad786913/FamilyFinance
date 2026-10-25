import { connectDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await connectDb();
    return Response.json({ ok: true, db: "connected" });
  } catch {
    return Response.json({ ok: false, db: "unavailable" }, { status: 503 });
  }
}
