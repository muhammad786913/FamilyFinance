import bcrypt from "bcryptjs";
import { connectDb } from "@/lib/db";
import User from "@/models/User";
import Household from "@/models/Household";
import Membership from "@/models/Membership";
import { json, parseJson, handle } from "@/lib/api";
import { normalizeEmail } from "@/lib/authOptions";
import { rateLimit, clientIp } from "@/lib/rateLimit";

export async function POST(req) {
  try {
    const rl = rateLimit(`signup:${clientIp(req)}`, { limit: 8, windowMs: 60_000 });
    if (!rl.ok) return json({ error: "Too many attempts. Try again shortly." }, 429);
    const body = await parseJson(req);
    const email = normalizeEmail(body.email);
    const name = String(body.name || "").trim();
    const password = String(body.password || "");
    if (!email || !email.includes("@")) return json({ error: "Enter a valid email address." }, 400);
    if (name.length < 2) return json({ error: "Enter your name." }, 400);
    if (password.length < 8) return json({ error: "Password must be at least 8 characters." }, 400);
    await connectDb();
    const exists = await User.findOne({ email }).select("_id").lean();
    if (exists) return json({ error: "Could not create account." }, 400);
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ email, name, passwordHash });
    const household = await Household.create({ name: `${name}'s household` });
    await Membership.create({ userId: user._id, householdId: household._id, role: "owner" });
    return json({ ok: true }, 201);
  } catch (err) {
    if (err.code === 11000) return json({ error: "Could not create account." }, 400);
    return handle(err);
  }
}
