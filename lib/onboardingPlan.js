/** Pure monthly-preview math for onboarding (integer minor units). */
const { majorToMinor } = require("./money");

function amount(value) {
  try {
    const minor = majorToMinor(value);
    return Number.isFinite(minor) && minor > 0 ? minor : 0;
  } catch {
    return 0;
  }
}

/** Converts a recurring amount to an equivalent monthly amount in minor units. */
function monthlyMinor(value, frequency = "monthly") {
  const minor = amount(value);
  if (frequency === "weekly") return Math.round((minor * 52) / 12);
  if (frequency === "daily") return Math.round((minor * 365) / 12);
  if (frequency === "yearly") return Math.round(minor / 12);
  return minor;
}

/**
 * Preview shown before onboarding is confirmed. It only uses numbers the person
 * typed; nothing is filled in or estimated silently.
 */
function monthlyPreview({ income = 0, frequency = "monthly", bills = [], debt = 0, goal = 0 } = {}) {
  const incomeMinor = monthlyMinor(income, frequency);
  const billMinor = (Array.isArray(bills) ? bills : []).reduce((sum, value) => sum + amount(value), 0);
  const debtMinor = amount(debt);
  const goalMinor = amount(goal);
  const essentialsMinor = billMinor + debtMinor;
  return {
    incomeMinor,
    billsMinor: billMinor,
    debtMinor,
    essentialsMinor,
    savingsMinor: goalMinor,
    leftoverMinor: incomeMinor - essentialsMinor - goalMinor,
    shortfall: incomeMinor < essentialsMinor + goalMinor,
  };
}

module.exports = { monthlyMinor, monthlyPreview, amount };
