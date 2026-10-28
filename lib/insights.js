const { addDays, enumerateDays } = require("./dates");

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function bandFor(score) {
  if (score >= 80) return { band: "strong", label: "Strong" };
  if (score >= 60) return { band: "okay", label: "Okay" };
  if (score >= 40) return { band: "tight", label: "Tight" };
  return { band: "at_risk", label: "At risk" };
}

/**
 * Deterministic, explainable 0-100 cash-flow health score.
 * Uses only figures already produced by the planning engine.
 */
function healthScore({ plan, household = {}, monthsCovered = 1 }) {
  const totals = (plan && plan.totals) || {};
  const reserve = Number(household.emergencyReserveMinor || 0);
  const unpaid = Number(totals.unpaidBillsMinor || 0);
  const confirmed = Number(totals.confirmedIncomeMinor || 0);
  const expectedLeft = Number(totals.expectedIncomeLeftMinor || 0);
  const spend = Number(totals.actualSpendMinor || 0);
  const shortages = (plan && plan.shortages) || [];
  const missed = (plan && plan.missedEssentials) || [];

  const factors = [];
  let score = 100;

  const essentialsAhead = unpaid > 0 ? unpaid : 1;
  const coverage = reserve / essentialsAhead;
  if (coverage < 1) {
    const impact = Math.round(clamp((1 - coverage) * 20, 0, 20));
    score -= impact;
    factors.push({
      label: coverage <= 0 ? "No emergency reserve set" : `Reserve covers ${Math.round(coverage * 100)}% of unpaid essentials`,
      impact: -impact,
      tone: "warn",
    });
  } else {
    factors.push({ label: "Emergency reserve covers unpaid essentials", impact: 0, tone: "good" });
  }

  if (shortages.length) {
    const impact = clamp(shortages.length * 8, 0, 32);
    score -= impact;
    factors.push({ label: `${shortages.length} projected shortage${shortages.length === 1 ? "" : "s"} this period`, impact: -impact, tone: "warn" });
  } else {
    factors.push({ label: "No shortage projected this period", impact: 0, tone: "good" });
  }

  if (missed.length) {
    const impact = clamp(missed.length * 10, 0, 30);
    score -= impact;
    factors.push({ label: `${missed.length} essential bill${missed.length === 1 ? "" : "s"} may be missed`, impact: -impact, tone: "warn" });
  } else {
    factors.push({ label: "All essential bills fit the projection", impact: 0, tone: "good" });
  }

  const incomeTotal = confirmed + expectedLeft;
  if (incomeTotal > 0) {
    const dependence = expectedLeft / incomeTotal;
    if (dependence > 0.4) {
      const impact = Math.round(clamp((dependence - 0.4) * 30, 0, 18));
      score -= impact;
      factors.push({
        label: `${Math.round(dependence * 100)}% of income is still expected, not received`,
        impact: -impact,
        tone: "warn",
      });
    }
  }

  if (confirmed > 0) {
    const savingsRate = (confirmed - spend) / confirmed;
    if (savingsRate < 0.1) {
      const impact = Math.round(clamp((0.1 - savingsRate) * 60, 0, 15));
      score -= impact;
      factors.push({
        label: savingsRate < 0 ? "Spending is above received income" : `Saving only ${Math.round(Math.max(0, savingsRate) * 100)}% of received income`,
        impact: -impact,
        tone: "warn",
      });
    } else {
      factors.push({ label: `Saving ${Math.round(savingsRate * 100)}% of received income`, impact: 0, tone: "good" });
    }
  } else if (spend > 0) {
    score -= 10;
    factors.push({ label: "Bills are paid before any income is recorded", impact: -10, tone: "warn" });
  }

  if (monthsCovered > 1) {
    factors.push({ label: `Reviewed across ${monthsCovered} planning cycles`, impact: 0, tone: "info" });
  }

  score = Math.round(clamp(score, 0, 100));
  return { score, ...bandFor(score), factors };
}

function todayRow(plan, asOfDate) {
  if (!plan || !Array.isArray(plan.daily) || !plan.daily.length) return null;
  return plan.daily.find((d) => d.date === asOfDate) || plan.daily[0];
}

/** Events (bills and income) between today and N days ahead, chronological. */
function buildAgenda(plan, asOfDate, days = 14) {
  if (!plan || !Array.isArray(plan.daily)) return [];
  const until = addDays(asOfDate, days);
  const rows = [];
  for (const day of plan.daily) {
    if (day.date < asOfDate || day.date > until) continue;
    for (const ev of day.events || []) {
      rows.push({
        date: day.date,
        type: ev.type,
        label: ev.label,
        amountMinor: ev.amountMinor,
        confirmed: !!ev.confirmed,
        essential: !!ev.essential,
      });
    }
  }
  return rows.slice(0, 30);
}

/** Counts whole days whose ending projected balance is at or above zero. */
function runwayDays(plan, asOfDate) {
  if (!plan || !Array.isArray(plan.daily)) return 0;
  let count = 0;
  for (const day of plan.daily) {
    if (day.date < asOfDate) continue;
    if (day.endingProjectedMinor < 0) break;
    count += 1;
  }
  return count;
}

function periodDays(from, to) {
  try {
    return enumerateDays(from, to).length;
  } catch {
    return 0;
  }
}

module.exports = { healthScore, buildAgenda, runwayDays, periodDays, todayRow, bandFor };
