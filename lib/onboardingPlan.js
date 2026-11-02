/** Pure monthly-preview math for onboarding (integer minor units). */
const { majorToMinor, MAX_INPUT_MINOR } = require("./money");

const MAX_MINOR = BigInt(Number.MAX_SAFE_INTEGER);

function overflowError() {
  const error = new Error("These amounts are too large to calculate exactly. Lower them and try again.");
  error.code = "AMOUNT_OVERFLOW";
  error.status = 400;
  return error;
}

function amount(value) {
  try {
    const minor = majorToMinor(value);
    return Number.isFinite(minor) && minor > 0 && minor <= MAX_INPUT_MINOR ? minor : 0;
  } catch {
    return 0;
  }
}

/** Exact round-half-up of minor * numerator / denominator, without float drift. */
function scaledMinor(minor, numerator, denominator) {
  const value = (BigInt(minor) * BigInt(numerator) + BigInt(denominator) / 2n) / BigInt(denominator);
  if (value > MAX_MINOR) throw overflowError();
  return Number(value);
}

function safeAdd(total, value) {
  const next = total + value;
  if (!Number.isSafeInteger(next)) throw overflowError();
  return next;
}

/** Converts a recurring amount to an equivalent monthly amount in minor units. */
function monthlyMinor(value, frequency = "monthly") {
  const minor = amount(value);
  if (frequency === "weekly") return scaledMinor(minor, 52, 12);
  if (frequency === "daily") return scaledMinor(minor, 365, 12);
  if (frequency === "yearly") return scaledMinor(minor, 1, 12);
  return minor;
}

/**
 * Preview shown before onboarding is confirmed. It only uses numbers the person
 * typed; nothing is filled in or estimated silently.
 */
function monthlyPreview({ income = 0, frequency = "monthly", bills = [], debt = 0, goal = 0 } = {}) {
  const incomeMinor = monthlyMinor(income, frequency);
  const billMinor = (Array.isArray(bills) ? bills : []).reduce((sum, value) => safeAdd(sum, amount(value)), 0);
  const debtMinor = amount(debt);
  const goalMinor = amount(goal);
  const essentialsMinor = safeAdd(billMinor, debtMinor);
  const committedMinor = safeAdd(essentialsMinor, goalMinor);
  return {
    incomeMinor,
    billsMinor: billMinor,
    debtMinor,
    essentialsMinor,
    savingsMinor: goalMinor,
    committedMinor,
    leftoverMinor: incomeMinor - committedMinor,
    shortfall: incomeMinor < committedMinor,
  };
}

module.exports = { monthlyMinor, monthlyPreview, amount };
