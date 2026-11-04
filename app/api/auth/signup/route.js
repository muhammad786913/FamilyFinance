import bcrypt from "bcryptjs";
import { connectDb } from "@/lib/db";
import User from "@/models/User";
import Household from "@/models/Household";
import Membership from "@/models/Membership";
import { json, parseJson, handle } from "@/lib/api";
import { emailAddress } from "@/lib/validation";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { passwordProblem } from "@/lib/passwordPolicy";
import { issueVerification } from "@/lib/issueVerification";

export async function POST(req) {
  try {
    const rl = rateLimit(`signup:${clientIp(req)}`, { limit: 8, windowMs: 60_000, banMs: 5 * 60_000 });
    if (!rl.ok) return json({ error: "Too many attempts. Try again shortly." }, 429);
    const body = await parseJson(req);
    // Honeypot: a real person never fills this hidden field.
    if (String(body.website || "").trim()) return json({ error: "Could not create account." }, 400);
    const email = emailAddress(body.email);
    const name = String(body.name || "").trim();
    const password = String(body.password || "");
    if (name.length < 2) return json({ error: "Enter your name." }, 400);
    const problem = passwordProblem(password, { email });
    if (problem) return json({ error: problem }, 400);
    await connectDb();
    const exists = await User.findOne({ email }).select("_id").lean();
    if (exists) return json({ error: "Could not create account." }, 400);
    const passwordHash = await bcrypt.hash(password, 12);
    // New accounts stay unverified until the emailed link is opened.
    const user = await User.create({ email, name, passwordHash, emailVerifiedAt: null });
    const household = await Household.create({ name: `${name}'s household` });
    await Membership.create({ userId: user._id, householdId: household._id, role: "owner" });
    let delivered = false;
    // Verification stays available but is optional at login. The API response
    // says so explicitly so the client never blocks a new account on email.
    let message = "Account created. You can start right away.";
    try {
      await issueVerification(user);
      delivered = true;
      message = "Account created. A verification email was also sent, but verifying is optional.";
    } catch (err) {
      if (err.status !== 503) console.error("verification email failed", err);
      else message = "Account created. You can start right away — email delivery is not configured.";
    }
    return json({ ok: true, verificationRequired: false, delivered, message }, 201);
  } catch (err) {
    if (err.code === 11000) return json({ error: "Could not create account." }, 400);
    return handle(err);
  }
}
