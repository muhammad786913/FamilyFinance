import bcrypt from "bcryptjs";
import { connectDb } from "@/lib/db";
import User from "@/models/User";
import Household from "@/models/Household";
import Membership from "@/models/Membership";
import { json, parseJson, handle } from "@/lib/api";
import { emailAddress } from "@/lib/validation";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { passwordProblem } from "@/lib/passwordPolicy";

export async function POST(req) {
  try {
    const rl = rateLimit(`signup:${clientIp(req)}`, { limit: 8, windowMs: 60_000, banMs: 5 * 60_000 });
    if (!rl.ok) return json({ error: "Too many attempts. Try again shortly." }, 429);
    const body = await parseJson(req);
    // Honeypot: a real person never fills this hidden field.
    if (String(body.website || "").trim()) return json({ error: "Could not create account." }, 400);
    const email = emailAddress(body.email);
    const providedName = String(body.name || "").trim();
    const name = providedName || email.split("@")[0].slice(0, 80);
    const password = String(body.password || "");
    const problem = passwordProblem(password, { email });
    if (problem) return json({ error: problem }, 400);
    await connectDb();
    const exists = await User.findOne({ email }).select("_id").lean();
    if (exists) {
      return json({ error: "This email is already registered. Please log in instead." }, 409);
    }
    const passwordHash = await bcrypt.hash(password, 12);
    // No email verification step: the account is usable the moment it is saved.
    const user = await User.create({ email, name, passwordHash, emailVerifiedAt: new Date() });
    const household = await Household.create({ name: providedName ? `${providedName}'s household` : "My household" });
    await Membership.create({ userId: user._id, householdId: household._id, role: "owner" });
    return json({ ok: true, verificationRequired: false, message: "Account created. You can start right away." }, 201);
  } catch (err) {
    if (err.code === 11000) {
      return json({ error: "This email is already registered. Please log in instead." }, 409);
    }
    return handle(err);
  }
}
