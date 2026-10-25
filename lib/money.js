/** Integer minor units (paisa). Round half-up when converting from major units. */

const SCALE = 100;

function assertFinite(n, label = "amount") {
  if (typeof n !== "number" || !Number.isFinite(n)) {
    throw new Error(`Invalid ${label}`);
  }
}

function majorToMinor(major) {
  const n = typeof major === "string" ? Number(major.trim()) : Number(major);
  assertFinite(n, "amount");
  return Math.round(n * SCALE);
}

function minorToMajor(minor) {
  assertFinite(minor, "minor amount");
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
  return values.reduce((sum, v) => sum + (Number(v) || 0), 0);
}

module.exports = { SCALE, majorToMinor, minorToMajor, formatMinor, addMinor };
