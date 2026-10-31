import { connectDb } from "@/lib/db";
import User from "@/models/User";
import EmailVerification from "@/models/EmailVerification";
import { json, parseJson, handle } from "@/lib/api";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { hashToken, tokenProblem } from "@/lib/emailVerification";

export async function POST(req) {
  try {
    const rl = rateLimit(`verify-email:${clientIp(req)}`, { limit: 10, windowMs: 60_000 });
    if (!rl.ok) return json({ error: "Too many attempts. Try again shortly." }, 429);
    const body = await parseJson(req);
    const token = String(body.token || "");
    if (!token || token.length > 200) return json({ error: "This verification link is invalid or has expired." }, 400);
    await connectDb();
    const row = await EmailVerification.findOne({ tokenHash: hashToken(token) });
    const problem = tokenProblem(row);
    if (problem) {
      return json(
        { error: problem === "expired" ? "This verification link has expired. Request a new one." : "This verification link is invalid or has already been used." },
        400
      );
    }
    const now = new Date();
    row.usedAt = now;
    await row.save();
    // One verified mailbox is enough: retire any other outstanding links.
    await EmailVerification.updateMany(
      { userId: row.userId, usedAt: null, _id: { $ne: row._id } },
      { $set: { usedAt: now } }
    );
    await User.updateOne({ _id: row.userId }, { $set: { emailVerifiedAt: now } });
    return json({ ok: true });
  } catch (err) {
    return handle(err);
  }
}
export const dynamic = "force-dynamic";
