import { connectDb } from "@/lib/db";
import User from "@/models/User";
import { json, parseJson, handle } from "@/lib/api";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { emailAddress } from "@/lib/validation";

/**
 * Tells the login page whether an email has an account. This is intentionally
 * explicit (the product asks for "no account" feedback), which does reveal
 * whether an address is registered; the limiter keeps bulk probing slow.
 */
export async function POST(req) {
  try {
    const rl = rateLimit(`account-status:${clientIp(req)}`, {
      limit: 20,
      windowMs: 60_000,
      banMs: 60_000,
    });
    if (!rl.ok) return json({ error: "Too many attempts. Try again shortly." }, 429);
    const body = await parseJson(req);
    if (String(body.website || "").trim()) return json({ exists: false });
    let email = "";
    try {
      email = emailAddress(body.email);
    } catch {
      return json({ exists: false });
    }
    await connectDb();
    const user = await User.findOne({ email }).select("_id").lean();
    return json({ exists: !!user });
  } catch (err) {
    return handle(err);
  }
}

export const dynamic = "force-dynamic";
