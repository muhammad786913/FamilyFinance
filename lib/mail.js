/**
 * Small Nodemailer wrapper shared by password reset and email verification.
 * Delivery is only "configured" when both SMTP_HOST and SMTP_FROM are set;
 * nothing here pretends an inbox exists.
 */
export function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);
}

export function appBaseUrl() {
  return (process.env.APP_URL || process.env.NEXTAUTH_URL || "").replace(/\/$/, "");
}

export async function sendMail({ to, subject, text }) {
  if (!smtpConfigured()) {
    const err = new Error(
      "Email delivery is not configured on this server. Ask an administrator to set SMTP_HOST and SMTP_FROM."
    );
    err.status = 503;
    throw err;
  }
  const { default: nodemailer } = await import("nodemailer");
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_PORT === "465",
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  await transport.sendMail({ from: process.env.SMTP_FROM, to, subject, text });
}
