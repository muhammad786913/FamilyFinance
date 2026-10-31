/** Pure request-field validators (no framework imports, unit-testable). */
const { majorToMinor } = require("./money");

function bad(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

/** Validates a real calendar date in YYYY-MM-DD form. */
function ymd(value, label = "date") {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw bad(`Invalid ${label}`);
  }
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
    throw bad(`Invalid ${label}`);
  }
  return value;
}

/** Converts a major-unit amount to integer minor units, rejecting negatives (and zero when required). */
function moneyField(value, label = "amount", { positive = false } = {}) {
  try {
    const minor = majorToMinor(value);
    if (minor < 0) throw new Error("negative");
    if (positive && minor === 0) throw new Error("zero");
    return minor;
  } catch {
    throw bad(`Invalid ${label}`);
  }
}

function oneOf(value, allowed, label = "value", fallback) {
  if (value == null || value === "") return fallback;
  if (!allowed.includes(value)) throw bad(`Invalid ${label}`);
  return value;
}

/**
 * Normalizes and validates an email address. This is deliberately strict about
 * shape only: a well-formed address proves nothing about the mailbox existing.
 */
function emailAddress(value, label = "email") {
  const email = String(value || "").trim().toLowerCase();
  if (email.length < 5 || email.length > 254) throw bad(`Enter a valid ${label} address.`);
  if (!/^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(email)) throw bad(`Enter a valid ${label} address.`);
  return email;
}

module.exports = { ymd, moneyField, oneOf, emailAddress };
