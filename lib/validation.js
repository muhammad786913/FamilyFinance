/** Pure request-field validators (no framework imports, unit-testable). */
const { majorToMinor, MAX_INPUT_MINOR } = require("./money");

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
    if (minor > MAX_INPUT_MINOR) throw new Error("too large");
    return minor;
  } catch {
    throw bad(`Invalid ${label}`);
  }
}

function nonNegativeNumberField(value, label = "value") {
  const raw = typeof value === "string" ? value.trim() : value;
  const number = raw === "" || raw == null ? NaN : Number(raw);
  if (!Number.isFinite(number) || number < 0) throw bad(`Invalid ${label}`);
  return number;
}

function nonNegativeIntegerField(value, label = "value", fallback = 0) {
  const raw = typeof value === "string" ? value.trim() : value;
  if (raw === "" || raw == null) return fallback;
  const number = Number(raw);
  if (!Number.isSafeInteger(number) || number < 0) throw bad(`Invalid ${label}`);
  return number;
}

/** Safely adds two non-negative integer minor-unit amounts from an API request. */
function addMinorField(current, increment, label = "amount") {
  const previous = current == null ? 0 : current;
  if (!Number.isSafeInteger(previous) || previous < 0 || !Number.isSafeInteger(increment) || increment < 0) {
    throw bad(`Invalid ${label}`);
  }
  const total = previous + increment;
  if (!Number.isSafeInteger(total)) throw bad(`${label} exceeds the supported limit`);
  return total;
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

module.exports = { ymd, moneyField, nonNegativeNumberField, nonNegativeIntegerField, addMinorField, oneOf, emailAddress };
