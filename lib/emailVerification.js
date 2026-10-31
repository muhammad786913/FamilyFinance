/**
 * Email-verification token helpers. Pure functions so expiry/usage rules can be
 * unit-tested without a database. Tokens themselves are 256-bit random values;
 * only their SHA-256 hash is ever stored.
 */
const crypto = require("crypto");

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

function newToken() {
  return crypto.randomBytes(32).toString("hex");
}

function hashToken(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

/** Returns "invalid" | "used" | "expired" | null (usable). */
function tokenProblem(row, now = Date.now()) {
  if (!row || !row.tokenHash) return "invalid";
  if (row.usedAt) return "used";
  const expires = new Date(row.expiresAt).getTime();
  if (!Number.isFinite(expires) || expires <= now) return "expired";
  return null;
}

module.exports = { newToken, hashToken, tokenProblem, TOKEN_TTL_MS };
