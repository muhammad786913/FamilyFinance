const test = require("node:test");
const assert = require("node:assert/strict");
const { survivalBudget } = require("../lib/engine/survivalBudget");

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
