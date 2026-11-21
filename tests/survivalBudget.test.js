const test = require("node:test");
const assert = require("node:assert/strict");
const { survivalBudget, roundRatio } = require("../lib/engine/survivalBudget");

test("does not use a single income threshold", () => {
  const small = survivalBudget({
    householdSize: 1,
    location: "Other",
    asOfDate: "2026-10-01",
    housingMinor: 1000000,
    foodMinor: 200000,
    confirmedIncomeMinor: 1500000,
    expectedIncomeMinor: 0,
  });
  const large = survivalBudget({
    householdSize: 8,
    location: "Karachi",
    asOfDate: "2026-10-01",
    housingMinor: 1000000,
    foodMinor: 200000,
    confirmedIncomeMinor: 1500000,
    expectedIncomeMinor: 0,
    useLocationEstimates: true,
  });
  assert.notEqual(small.monthlyEssentialMinor, large.monthlyEssentialMinor);
});

test("shortage explains essentials vs income", () => {
  const result = survivalBudget({
    householdSize: 4,
    location: "Lahore",
    asOfDate: "2026-10-01",
    housingMinor: 5000000,
    foodMinor: 2000000,
    confirmedIncomeMinor: 100000,
    expectedIncomeMinor: 0,
  });
  assert.equal(result.status, "exceeds");
  assert.match(result.headline, /exceed/i);
});


test("survival budget rejects totals that exceed safe minor-unit calculations", () => {
  assert.throws(
    () => survivalBudget({
      householdSize: 1, location: "Other", asOfDate: "2026-10-01",
      housingMinor: Number.MAX_SAFE_INTEGER, foodMinor: 1,
      confirmedIncomeMinor: 0, expectedIncomeMinor: 0,
    }),
    /Monthly essentials total exceeds/
  );
  assert.throws(
    () => survivalBudget({
      householdSize: 1, location: "Other", asOfDate: "2026-10-01",
      housingMinor: 0, confirmedIncomeMinor: Number.MAX_SAFE_INTEGER, expectedIncomeMinor: 1,
    }),
    /Projected income total exceeds/
  );
});

test("weekly and daily survival amounts divide exact paisa half-up", () => {
  const february = survivalBudget({
    householdSize: 1,
    location: "Other",
    asOfDate: "2026-02-01",
    housingMinor: 122,
    foodMinor: 0,
    utilitiesMinor: 0,
    transportMinor: 0,
    medicalMinor: 0,
    educationMinor: 0,
    otherEssentialMinor: 0,
    useLocationEstimates: false,
    confirmedIncomeMinor: 0,
    expectedIncomeMinor: 0,
  });
  // 122 / 28 * 7 is exactly 30.5: float Math.round gives 30, exact half-up gives 31.
  assert.equal(february.weeklyMinor, 31);
  assert.equal(february.dailyMinor, 4);
  assert.equal(roundRatio(5, 2), 3);
  assert.equal(roundRatio(1, 3), 0);
  assert.throws(() => roundRatio(1, 0), /Invalid ratio denominator/);
});
