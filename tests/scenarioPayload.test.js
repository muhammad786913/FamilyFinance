const test = require("node:test");
const assert = require("node:assert/strict");
const { buildScenarioPayload } = require("../lib/scenarioPayload");

const period = { start: "2026-10-31" };

test("scenario payload preserves an explicit zero expense multiplier", () => {
  const payload = buildScenarioPayload({ expenseCategory: "groceries", expenseMultiplier: "0" }, period);
  assert.equal(payload.expenseMultiplier, 0);
});

test("scenario payload rejects negative and invalid expense multipliers", () => {
  for (const value of ["-1", "abc", "Infinity"]) {
    assert.throws(
      () => buildScenarioPayload({ expenseCategory: "groceries", expenseMultiplier: value }, period),
      /Invalid expense multiplier/
    );
  }
});

test("blank extra amount is omitted but explicit zero is retained", () => {
  const blank = buildScenarioPayload({ extraAmount: "" }, period);
  const zero = buildScenarioPayload({ extraAmount: "0" }, period);
  assert.equal(blank.extraExpense, null);
  assert.equal(zero.extraExpense.amountMinor, 0);
});

test("extra amount uses the same safe money limit", () => {
  assert.throws(
    () => buildScenarioPayload({ extraAmount: Number.MAX_SAFE_INTEGER / 100 + 1 }, period),
    /Invalid extra amount/
  );
});


test("scenario payload rejects negative or fractional delay days", () => {
  assert.equal(buildScenarioPayload({ delayDays: "0" }, period).delayDays, 0);
  assert.equal(buildScenarioPayload({ delayDays: "4" }, period).delayDays, 4);
  for (const delayDays of ["-1", "1.5", "Infinity"]) {
    assert.throws(() => buildScenarioPayload({ delayDays }, period), /Invalid delay days/);
  }
});

test("simulated extra expenses must fall inside the selected planning period", () => {
  const cycle = { start: "2026-10-01", end: "2026-10-31" };
  const inRange = buildScenarioPayload(
    { extraAmount: "1000", extraDate: "2026-10-31" },
    cycle
  );
  assert.equal(inRange.extraExpense.dueDate, "2026-10-31");
  assert.equal(inRange.extraExpense.amountMinor, 100000);

  for (const extraDate of ["2026-09-30", "2026-11-01", "2026-02-30", "not-a-date"]) {
    assert.throws(
      () => buildScenarioPayload({ extraAmount: "1000", extraDate }, cycle),
      /planning period|Invalid extra date/,
      `expected rejection for ${extraDate}`
    );
  }
});
