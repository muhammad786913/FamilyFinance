import crypto from "crypto";
import bcrypt from "bcryptjs";
import { connectDb } from "@/lib/db";
import User from "@/models/User";
import PasswordReset from "@/models/PasswordReset";
import { json, parseJson, handle } from "@/lib/api";
import { rateLimit, clientIp } from "@/lib/rateLimit";

export async function POST(req) {
  try {
    const rl = rateLimit(`reset:${clientIp(req)}`, { limit: 8, windowMs: 60_000 });
    if (!rl.ok) return json({ error: "Too many attempts. Try again shortly." }, 429);
    const body = await parseJson(req);
    const token = String(body.token || "");
    const password = String(body.password || "");
    if (password.length < 8) return json({ error: "Password must be at least 8 characters." }, 400);
    if (!token) return json({ error: "Reset token is missing." }, 400);
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    await connectDb();
    const row = await PasswordReset.findOne({ tokenHash, usedAt: null, expiresAt: { $gt: new Date() } });
    if (!row) return json({ error: "This reset link is invalid or has expired." }, 400);
    const passwordHash = await bcrypt.hash(password, 12);
    await User.updateOne({ _id: row.userId }, { passwordHash });
    row.usedAt = new Date();
    await row.save();
    return json({ ok: true });
  } catch (err) {
    return handle(err);
  }
}
