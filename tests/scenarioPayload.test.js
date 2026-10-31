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
