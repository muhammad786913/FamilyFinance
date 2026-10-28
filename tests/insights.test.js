const test = require("node:test");
const assert = require("node:assert/strict");
const { healthScore, buildAgenda, runwayDays, periodDays, bandFor } = require("../lib/insights");

function plan(overrides = {}) {
  return {
    totals: {
      confirmedIncomeMinor: 1000000,
      expectedIncomeLeftMinor: 0,
      actualSpendMinor: 400000,
      unpaidBillsMinor: 200000,
      ...(overrides.totals || {}),
    },
    shortages: overrides.shortages || [],
    missedEssentials: overrides.missedEssentials || [],
    daily:
      overrides.daily ||
      [
        { date: "2026-10-26", endingProjectedMinor: 500000, events: [] },
        { date: "2026-10-27", endingProjectedMinor: 450000, events: [] },
      ],
  };
}

test("health score rewards a covered reserve and no shortages", () => {
  const result = healthScore({
    plan: plan(),
    household: { emergencyReserveMinor: 300000 },
  });
  assert.equal(result.score, 100);
  assert.equal(result.band, "strong");
  assert.ok(result.factors.every((f) => f.impact <= 0));
});

test("health score drops for an empty reserve, shortages, and missed essentials", () => {
  const result = healthScore({
    plan: plan({
      shortages: [{ date: "2026-10-10" }, { date: "2026-10-11" }],
      missedEssentials: [{ label: "Rent" }],
      totals: { confirmedIncomeMinor: 0, expectedIncomeLeftMinor: 500000, actualSpendMinor: 100000 },
    }),
    household: { emergencyReserveMinor: 0 },
  });
  assert.ok(result.score < 60, `expected a weak score, got ${result.score}`);
  assert.equal(result.band, "at_risk");
  assert.ok(result.factors.some((f) => f.tone === "warn"));
});

test("health score never leaves 0-100", () => {
  const result = healthScore({
    plan: plan({
      shortages: Array.from({ length: 20 }, (_, i) => ({ date: `2026-10-${String(i + 1).padStart(2, "0")}` })),
      missedEssentials: Array.from({ length: 10 }, (_, i) => ({ label: `bill ${i}` })),
      totals: { confirmedIncomeMinor: 0, expectedIncomeLeftMinor: 0, actualSpendMinor: 0, unpaidBillsMinor: 0 },
    }),
    household: { emergencyReserveMinor: 0 },
  });
  assert.ok(result.score >= 0 && result.score <= 100);
  assert.equal(result.band, "at_risk");
  assert.equal(bandFor(0).label, "At risk");
  assert.equal(bandFor(100).band, "strong");
});

test("agenda includes only events inside the window and stays chronological", () => {
  const data = plan({
    daily: [
      {
        date: "2026-10-27",
        endingProjectedMinor: 1,
        events: [{ type: "expense", label: "Rent", amountMinor: 100, confirmed: false, essential: true }],
      },
      {
        date: "2026-11-02",
        endingProjectedMinor: 1,
        events: [{ type: "income", label: "Salary", amountMinor: 200, confirmed: true }],
      },
      {
        date: "2026-12-01",
        endingProjectedMinor: 1,
        events: [{ type: "expense", label: "Too far", amountMinor: 300 }],
      },
    ],
  });
  const rows = buildAgenda(data, "2026-10-27", 14);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].label, "Rent");
  assert.equal(rows[0].essential, true);
  assert.equal(rows[1].label, "Salary");
  assert.equal(rows[1].confirmed, true);
});

test("runway counts days until the projection goes negative", () => {
  const data = plan({
    daily: [
      { date: "2026-10-26", endingProjectedMinor: 999 },
      { date: "2026-10-27", endingProjectedMinor: 500 },
      { date: "2026-10-28", endingProjectedMinor: 100 },
      { date: "2026-10-29", endingProjectedMinor: -1 },
      { date: "2026-10-30", endingProjectedMinor: 900 },
    ],
  });
  assert.equal(runwayDays(data, "2026-10-27"), 2);
  assert.equal(runwayDays(null, "2026-10-27"), 0);
});

test("periodDays counts inclusive days and tolerates bad input", () => {
  assert.equal(periodDays("2026-10-01", "2026-10-31"), 31);
  assert.equal(periodDays("2026-10-01", "2026-10-01"), 1);
  assert.equal(periodDays("bad", "2026-10-31"), 0);
});
