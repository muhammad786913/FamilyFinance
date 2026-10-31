import crypto from "crypto";
import { connectDb } from "@/lib/db";
import User from "@/models/User";
import PasswordReset from "@/models/PasswordReset";
import { json, parseJson, handle } from "@/lib/api";
import { normalizeEmail } from "@/lib/authOptions";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { smtpConfigured, sendMail } from "@/lib/mail";

export async function POST(req) {
  try {
    const rl = rateLimit(`forgot:${clientIp(req)}`, { limit: 5, windowMs: 60_000, banMs: 5 * 60_000 });
    if (!rl.ok) return json({ error: "Too many attempts. Try again shortly." }, 429);
    const body = await parseJson(req);
    // Honeypot: answer exactly like a normal request, but do nothing.
    if (String(body.website || "").trim()) {
      return json({ ok: true, delivered: true, message: "If that account exists, a reset email was sent." });
    }
    const email = normalizeEmail(body.email);
    const smtpReady = smtpConfigured();
    await connectDb();
    const user = email ? await User.findOne({ email }).lean() : null;
    if (!smtpReady) {
      return json({
        ok: false,
        delivered: false,
        error: "Email delivery is not configured on this server. Ask an administrator to set SMTP_HOST and SMTP_FROM.",
      }, 503);
    }
    if (user) {
      const token = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
      await PasswordReset.create({
        userId: user._id,
        tokenHash,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      });
      const base = process.env.APP_URL || process.env.NEXTAUTH_URL || "";
      await sendMail({
        to: user.email,
        subject: "FamilyFinance password reset",
        text: `Reset your password: ${base}/reset-password?token=${token}`,
      });    }
    return json({
      ok: true,
      delivered: true,
      message: "If that account exists, a reset email was sent.",
    });
  } catch (err) {
    return handle(err);
  }
}
