import { connectDb } from "@/lib/db";
import User from "@/models/User";
import { json, parseJson, handle } from "@/lib/api";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { emailAddress } from "@/lib/validation";
import { issueVerification } from "@/lib/issueVerification";

const GENERIC = "If an unverified account exists for that address, a new verification link was sent.";

export async function POST(req) {
  try {
    const rl = rateLimit(`resend-verify:${clientIp(req)}`, { limit: 3, windowMs: 10 * 60_000, banMs: 10 * 60_000 });
    if (!rl.ok) return json({ error: "Too many requests. Try again in a few minutes." }, 429);
    const body = await parseJson(req);
    if (String(body.website || "").trim()) return json({ ok: true, message: GENERIC });
    let email = "";
    try {
      email = emailAddress(body.email);
    } catch {
      return json({ ok: true, message: GENERIC });
    }
    const emailLimit = rateLimit(`resend-verify-email:${email}`, { limit: 1, windowMs: 60_000, banMs: 60_000 });
    if (!emailLimit.ok) return json({ error: "A link was sent recently. Wait a minute before asking again." }, 429);
    await connectDb();
    const user = await User.findOne({ email }).lean();
    if (user && !user.emailVerifiedAt) {
      try {
        await issueVerification(user);
      } catch (err) {
        if (err.status === 503) return json({ error: err.message }, 503);
        throw err;
      }
    }
    return json({ ok: true, message: GENERIC });
  } catch (err) {
    return handle(err);
  }
}
export const dynamic = "force-dynamic";
