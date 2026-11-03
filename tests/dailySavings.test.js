const test = require("node:test");
const assert = require("node:assert/strict");
const { MAX_INPUT_MINOR } = require("../lib/money");
const { daySaving, summarizeSaving, recentDays } = require("../lib/dailySavings");

test("daySaving marks half or more of the budget kept as great", () => {
  assert.equal(daySaving({ budgetMinor: 1000, spentMinor: 500 }).status, "great");
  assert.equal(daySaving({ budgetMinor: 1001, spentMinor: 500 }).status, "great");
  assert.equal(daySaving({ budgetMinor: 1001, spentMinor: 501 }).status, "good");
  const result = daySaving({ budgetMinor: 1000, spentMinor: 250 });
  assert.equal(result.savedMinor, 750);
  assert.equal(result.savedPct, 75);
  assert.equal(result.status, "great");
});

test("daySaving reports small savings as good", () => {
  const result = daySaving({ budgetMinor: 10000, spentMinor: 9900 });
  assert.equal(result.savedMinor, 100);
  assert.equal(result.savedPct, 1);
  assert.equal(result.status, "good");
});

test("daySaving separates full budget use from overspending", () => {
  assert.deepEqual(daySaving({ budgetMinor: 1000, spentMinor: 1000 }), {
    budgetMinor: 1000,
    spentMinor: 1000,
    savedMinor: 0,
    savedPct: 0,
    status: "used",
  });
  const over = daySaving({ budgetMinor: 1000, spentMinor: 1500 });
  assert.equal(over.savedMinor, -500);
  assert.equal(over.savedPct, -50);
  assert.equal(over.status, "over");
});

test("daySaving handles a zero budget", () => {
  assert.equal(daySaving({ budgetMinor: 0, spentMinor: 0 }).status, "empty");
  const over = daySaving({ budgetMinor: 0, spentMinor: 100 });
  assert.equal(over.status, "over");
  assert.equal(over.savedMinor, -100);
  assert.equal(over.savedPct, -100);
});

test("daySaving rejects invalid or unsafe amounts", () => {
  assert.throws(() => daySaving({ budgetMinor: -1, spentMinor: 0 }), /Invalid safe-to-spend amount/);
  assert.throws(() => daySaving({ budgetMinor: 10.5, spentMinor: 0 }), /Invalid safe-to-spend amount/);
  assert.throws(() => daySaving({ budgetMinor: 100, spentMinor: -1 }), /Invalid spent amount/);
  assert.throws(() => daySaving({ budgetMinor: Number.MAX_SAFE_INTEGER + 1, spentMinor: 0 }), /Invalid/);
});

test("summarizeSaving counts only checked-in days and uses the stored budget", () => {
  const daily = [
    { date: "2026-11-01", suggestedDiscretionaryMinor: 999999 },
    { date: "2026-11-02", suggestedDiscretionaryMinor: 4000 },
    { date: "2026-11-03", suggestedDiscretionaryMinor: 3000 },
    { date: "2026-11-04", suggestedDiscretionaryMinor: 2000 },
  ];
  const checkins = [
    { date: "2026-11-01", budgetMinor: 5000, spentMinor: 2000 },
    { date: "2026-11-02", budgetMinor: 4000, spentMinor: 4500 },
    { date: "2026-10-31", budgetMinor: 4000, spentMinor: 0 },
  ];
  assert.deepEqual(summarizeSaving({ daily, checkins }), {
    trackedDays: 2,
    savedDays: 1,
    netSavedMinor: 2500,
    bestDayMinor: 3000,
  });
});

test("summarizeSaving falls back to the plan budget when no snapshot exists", () => {
  const daily = [{ date: "2026-11-01", suggestedDiscretionaryMinor: 6000 }];
  const checkins = [{ date: "2026-11-01", spentMinor: 1000 }];
  assert.deepEqual(summarizeSaving({ daily, checkins }), {
    trackedDays: 1,
    savedDays: 1,
    netSavedMinor: 5000,
    bestDayMinor: 5000,
  });
});

test("summarizeSaving can be net negative across a cycle", () => {
  const daily = [
    { date: "2026-11-01", suggestedDiscretionaryMinor: 2000 },
    { date: "2026-11-02", suggestedDiscretionaryMinor: 2000 },
    { date: "2026-11-03", suggestedDiscretionaryMinor: 2000 },
  ];
  const checkins = [
    { date: "2026-11-01", budgetMinor: 2000, spentMinor: 1000 },
    { date: "2026-11-02", budgetMinor: 2000, spentMinor: 3000 },
    { date: "2026-11-03", budgetMinor: 2000, spentMinor: 6000 },
  ];
  assert.equal(summarizeSaving({ daily, checkins }).netSavedMinor, -4000);
});

test("summarizeSaving refuses a total beyond safe integer precision", () => {
  const daily = Array.from({ length: 100 }, (_, index) => ({
    date: `2026-11-${String((index % 28) + 1).padStart(2, "0")}`,
    suggestedDiscretionaryMinor: MAX_INPUT_MINOR,
  }));
  const checkins = daily.map((day) => ({ date: day.date, budgetMinor: MAX_INPUT_MINOR, spentMinor: 0 }));
  assert.throws(() => summarizeSaving({ daily, checkins }), /exceeds the supported limit/);
});

test("recentDays returns the last N days up to today", () => {
  const daily = Array.from({ length: 8 }, (_, index) => ({
    date: `2026-11-${String(index + 1).padStart(2, "0")}`,
    suggestedDiscretionaryMinor: 1000,
  }));
  const checkins = [
    { date: "2026-11-02", budgetMinor: 1000, spentMinor: 0 },
    { date: "2026-11-04", budgetMinor: 900, spentMinor: 400 },
  ];
  const rows = recentDays({ daily, checkins, today: "2026-11-05", count: 3 });
  assert.deepEqual(
    rows.map((row) => row.date),
    ["2026-11-03", "2026-11-04", "2026-11-05"]
  );
  assert.equal(rows[0].status, "unlogged");
  assert.equal(rows[0].savedMinor, null);
  assert.equal(rows[1].status, "great");
  assert.equal(rows[1].budgetMinor, 900);
  assert.equal(rows[1].savedMinor, 500);
  assert.equal(rows[2].status, "unlogged");
});

test("recentDays marks overspending and full-budget use", () => {
  const daily = [
    { date: "2026-11-03", suggestedDiscretionaryMinor: 1000 },
    { date: "2026-11-04", suggestedDiscretionaryMinor: 1000 },
    { date: "2026-11-05", suggestedDiscretionaryMinor: 1000 },
  ];
  const checkins = [
    { date: "2026-11-03", budgetMinor: 1000, spentMinor: 1500 },
    { date: "2026-11-04", budgetMinor: 1000, spentMinor: 1000 },
  ];
  const rows = recentDays({ daily, checkins, today: "2026-11-05", count: 7 });
  assert.equal(rows.length, 7);
  const byDate = Object.fromEntries(rows.map((row) => [row.date, row]));
  assert.equal(rows[0].date, "2026-10-30");
  assert.equal(byDate["2026-11-03"].status, "over");
  assert.equal(byDate["2026-11-03"].savedMinor, -500);
  assert.equal(byDate["2026-11-04"].status, "used");
  assert.equal(byDate["2026-11-05"].status, "unlogged");
});

test("recentDays keeps a full strip even before the cycle has seven days", () => {
  const daily = [
    { date: "2026-11-01", suggestedDiscretionaryMinor: 2000 },
    { date: "2026-11-02", suggestedDiscretionaryMinor: 2000 },
  ];
  const rows = recentDays({ daily, checkins: [], today: "2026-11-02", count: 7 });
  assert.equal(rows.length, 7);
  assert.equal(rows[0].date, "2026-10-27");
  assert.ok(rows.every((row) => row.status === "unlogged"));
  assert.equal(rows[6].budgetMinor, 2000);
});
