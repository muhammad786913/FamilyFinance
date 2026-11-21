/** Integer minor units (paisa). Round half-up when converting from major units. */

const SCALE = 100;
// Largest major-unit amount that still fits in a safe integer when stored as paisa.
const MAX_MAJOR = Number.MAX_SAFE_INTEGER / SCALE;
// User-entered amounts are capped here (Rs 1 trillion). Below this cap every
// cent is still exact in a double, and a full month of daily income at the cap
// stays well inside the safe-integer range.
const MAX_INPUT_MAJOR = 1_000_000_000_000;
const MAX_INPUT_MINOR = MAX_INPUT_MAJOR * SCALE;

function assertFinite(n, label = "amount") {
  if (typeof n !== "number" || !Number.isFinite(n)) {
    throw new Error(`Invalid ${label}`);
  }
}

/** Expands a decimal/exponent literal without losing the digits that decide half-up rounding. */
function decimalParts(value) {
  const raw = (typeof value === "string" ? value.trim() : String(value));
  const match = /^([+-]?)(\d+)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(raw);
  if (!match) throw new Error("Invalid amount");
  const [, sign, integer, fraction = "", exponentText = "0"] = match;
  const exponent = Number(exponentText);
  if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > 1000) {
    throw new Error("Amount exceeds the supported limit");
  }
  const digits = `${integer}${fraction}`;
  const point = integer.length + exponent;
  let decimal;
  if (point <= 0) decimal = `0.${"0".repeat(-point)}${digits}`;
  else if (point >= digits.length) decimal = `${digits}${"0".repeat(point - digits.length)}`;
  else decimal = `${digits.slice(0, point)}.${digits.slice(point)}`;
  return { sign, decimal };
}

function majorToMinor(major) {
  const n = typeof major === "string" ? Number(major.trim()) : Number(major);
  assertFinite(n, "amount");
  const { sign, decimal } = decimalParts(major);
  const [whole, fraction = ""] = decimal.split(".");
  const cents = BigInt((fraction + "000").slice(0, 2));
  let minor = BigInt(whole) * BigInt(SCALE) + cents;
  // Half-up must inspect the third decimal digit; multiplying a binary float by
  // 100 first loses it for values such as 1.005 and 8.165.
  if ((fraction.charCodeAt(2) || 0) - 48 >= 5) minor += 1n;
  if (sign === "-") minor = -minor;
  if (minor > BigInt(Number.MAX_SAFE_INTEGER) || minor < -BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("Amount exceeds the supported limit");
  }
  return Number(minor);
}

function minorToMajor(minor) {
  if (!Number.isSafeInteger(minor)) {
    throw new Error("Invalid minor amount");
  }
  return minor / SCALE;
}

function formatMinor(minor, currency = "PKR", locale = "en-PK") {
  const n = minorToMajor(Number(minor) || 0);
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 2 }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

function addMinor(...values) {
  return values.reduce((sum, value) => {
    const amount = Number(value) || 0;
    const total = sum + amount;
    if (!Number.isSafeInteger(amount) || !Number.isSafeInteger(total)) {
      throw new Error("Money total exceeds the supported limit");
    }
    return total;
  }, 0);
}

module.exports = {
  SCALE,
  MAX_MAJOR,
  MAX_INPUT_MAJOR,
  MAX_INPUT_MINOR,
  majorToMinor,
  minorToMajor,
  formatMinor,
  addMinor,
};
