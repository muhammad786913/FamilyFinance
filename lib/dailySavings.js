/** Pure daily-savings feedback math (integer minor units). */

function bad(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function minor(value, label) {
  const amount = value == null ? 0 : Number(value);
  if (!Number.isSafeInteger(amount) || amount < 0) throw bad(`Invalid ${label}`);
  return amount;
}

function addSigned(total, value) {
  const next = total + value;
  if (!Number.isSafeInteger(next)) throw bad("Savings total exceeds the supported limit");
  return next;
}

/** Check-ins store the budget the person actually saw; fall back to the plan row. */
function rowBudget(checkin, fallback) {
  if (checkin && Number.isSafeInteger(checkin.budgetMinor) && checkin.budgetMinor >= 0) {
    return checkin.budgetMinor;
  }
  return minor(fallback, "safe-to-spend amount");
}

/**
 * Compares today's safe-to-spend budget with what the person logged spending.
 * "Saved" means money left inside the budget, not money moved into a goal.
 */
function daySaving({ budgetMinor = 0, spentMinor = 0 } = {}) {
  const budget = minor(budgetMinor, "safe-to-spend amount");
  const spent = minor(spentMinor, "spent amount");
  const savedMinor = budget - spent;
  let status;
  if (budget === 0 && spent === 0) status = "empty";
  else if (savedMinor > 0) status = savedMinor >= Math.ceil(budget / 2) ? "great" : "good";
  else if (savedMinor === 0) status = "used";
  else status = "over";
  return {
    budgetMinor: budget,
    spentMinor: spent,
    savedMinor,
    savedPct: budget > 0 ? Math.round((savedMinor / budget) * 100) : spent > 0 ? -100 : 0,
    status,
  };
}

/** Cycle summary that counts only days the person actually checked in. */
function summarizeSaving({ daily = [], checkins = [] } = {}) {
  const checkinByDate = new Map();
  for (const row of Array.isArray(checkins) ? checkins : []) {
    if (row && typeof row.date === "string") checkinByDate.set(row.date, row);
  }
  let trackedDays = 0;
  let savedDays = 0;
  let netSavedMinor = 0;
  let bestDayMinor = 0;
  for (const day of Array.isArray(daily) ? daily : []) {
    const checkin = checkinByDate.get(day.date);
    if (!checkin) continue;
    const result = daySaving({
      budgetMinor: rowBudget(checkin, day.suggestedDiscretionaryMinor || 0),
      spentMinor: checkin.spentMinor,
    });
    trackedDays += 1;
    netSavedMinor = addSigned(netSavedMinor, result.savedMinor);
    if (result.savedMinor > 0) {
      savedDays += 1;
      if (result.savedMinor > bestDayMinor) bestDayMinor = result.savedMinor;
    }
  }
  return { trackedDays, savedDays, netSavedMinor, bestDayMinor };
}

/** Last N days up to today, with check-ins joined to the plan's daily budget. */
function shiftDays(ymd, delta) {
  const [year, month, day] = String(ymd).split("-").map(Number);
  const dt = new Date(Date.UTC(year, month - 1, day + delta));
  return dt.toISOString().slice(0, 10);
}

function recentDays({ daily = [], checkins = [], today, count = 7 } = {}) {
  const planByDate = new Map();
  for (const day of Array.isArray(daily) ? daily : []) {
    if (day && typeof day.date === "string") planByDate.set(day.date, day);
  }
  const checkinByDate = new Map();
  for (const row of Array.isArray(checkins) ? checkins : []) {
    if (row && typeof row.date === "string") checkinByDate.set(row.date, row);
  }
  // Always show a full seven-day strip, even at the start of a planning cycle.
  const days = Array.isArray(daily) ? daily : [];
  const dates = today
    ? Array.from({ length: Math.max(1, count) }, (_, index) => shiftDays(today, index - (Math.max(1, count) - 1)))
    : days.filter((day) => day && typeof day.date === "string").map((day) => day.date).slice(-count);
  return dates.map((date) => {
    const day = planByDate.get(date);
    const checkin = checkinByDate.get(date);
    const budgetMinor = rowBudget(checkin, day?.suggestedDiscretionaryMinor || 0);
    if (!checkin) {
      return { date, logged: false, budgetMinor, spentMinor: 0, savedMinor: null, savedPct: null, status: "unlogged" };
    }
    return { date, logged: true, ...daySaving({ budgetMinor, spentMinor: checkin.spentMinor }) };
  });
}

module.exports = { daySaving, summarizeSaving, recentDays };
