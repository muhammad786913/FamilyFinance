import EmailVerification from "@/models/EmailVerification";
import { newToken, hashToken, TOKEN_TTL_MS } from "@/lib/emailVerification";
import { sendMail, appBaseUrl } from "@/lib/mail";

/**
 * Creates a fresh one-time token for the user, retires older unused tokens, and
 * tries to deliver it. Throws a 503-ish error from sendMail when SMTP is missing,
 * so callers can report delivery honestly instead of claiming mail was sent.
 */
export async function issueVerification(user) {
  const token = newToken();
  await EmailVerification.updateMany(
    { userId: user._id, usedAt: null },
    { $set: { usedAt: new Date() } }
  );
  await EmailVerification.create({
    userId: user._id,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
  });
  const url = `${appBaseUrl()}/verify-email?token=${token}`;
  await sendMail({
    to: user.email,
    subject: "Verify your FamilyFinance email",
    text: [
      "Confirm your email address to finish setting up FamilyFinance.",
      `Open this link within 24 hours: ${url}`,
      "",
      "If you did not create this account, you can ignore this message.",
    ].join("\n"),
  });
}
