const test = require("node:test");
const assert = require("node:assert/strict");
const { newToken, hashToken, tokenProblem } = require("../lib/emailVerification");
const { monthlyPreview, monthlyMinor } = require("../lib/onboardingPlan");
const { MAX_INPUT_MAJOR } = require("../lib/money");
const { emailAddress } = require("../lib/validation");

test("verification tokens are random and never stored raw", () => {
  const a = newToken();
  const b = newToken();
  assert.equal(a.length, 64);
  assert.notEqual(a, b);
  assert.equal(hashToken(a).length, 64);
  assert.notEqual(hashToken(a), a);
});

test("verification token rules cover valid, used, expired, and missing rows", () => {
  const now = Date.now();
  assert.equal(tokenProblem(null), "invalid");
  assert.equal(tokenProblem({ tokenHash: "x", expiresAt: new Date(now + 1000) }), null);
  assert.equal(tokenProblem({ tokenHash: "x", expiresAt: new Date(now - 1000) }), "expired");
  assert.equal(tokenProblem({ tokenHash: "x", expiresAt: new Date(now + 1000), usedAt: new Date() }), "used");
});

test("email validation accepts normal addresses and rejects malformed ones", () => {
  assert.equal(emailAddress(" Person@Example.COM "), "person@example.com");
  for (const bad of ["not-an-email", "a@b", "a@@b.com", "", "a b@c.com", "@example.com"]) {
    assert.throws(() => emailAddress(bad), /valid email/);
  }
});

test("monthly preview converts frequency and flags a shortfall", () => {
  assert.equal(monthlyMinor(1200, "weekly"), Math.round((120000 * 52) / 12));
  assert.equal(monthlyMinor(150000, "monthly"), 15_000_000);
  assert.equal(monthlyMinor(500, "daily"), Math.round((50000 * 365) / 12));
  assert.equal(monthlyMinor(120000, "yearly"), 1_000_000);
  const plan = monthlyPreview({ income: 50000, bills: [10000, 5000], debt: 2000, goal: 3000 });
  assert.equal(plan.incomeMinor, 5_000_000);
  assert.equal(plan.billsMinor, 1_500_000);
  assert.equal(plan.essentialsMinor, 1_700_000);
  assert.equal(plan.savingsMinor, 300_000);
  assert.equal(plan.leftoverMinor, 3_000_000);
  assert.equal(plan.shortfall, false);
  const tight = monthlyPreview({ income: 1000, bills: [1200] });
  assert.equal(tight.shortfall, true);
  assert.ok(tight.leftoverMinor < 0);
});

test("onboarding preview never invents amounts for blank fields", () => {
  const plan = monthlyPreview({ income: "", bills: ["", null, undefined], debt: "", goal: "" });
  assert.equal(plan.incomeMinor, 0);
  assert.equal(plan.billsMinor, 0);
  assert.equal(plan.leftoverMinor, 0);
  assert.equal(plan.shortfall, false);
});

test("preview math stays exact when every field is at the input cap", () => {
  const plan = monthlyPreview({
    income: MAX_INPUT_MAJOR,
    frequency: "daily",
    bills: Array(8).fill(MAX_INPUT_MAJOR),
    debt: MAX_INPUT_MAJOR,
    goal: MAX_INPUT_MAJOR,
  });
  const incomeMinor = BigInt(MAX_INPUT_MAJOR) * 100n;
  const expectedIncome = Number((incomeMinor * 365n + 6n) / 12n);
  assert.equal(plan.incomeMinor, expectedIncome);
  assert.equal(plan.billsMinor, 8 * MAX_INPUT_MAJOR * 100);
  assert.equal(plan.debtMinor, MAX_INPUT_MAJOR * 100);
  assert.equal(plan.savingsMinor, MAX_INPUT_MAJOR * 100);
  assert.equal(plan.committedMinor, 10 * MAX_INPUT_MAJOR * 100);
  assert.equal(plan.leftoverMinor, expectedIncome - 10 * MAX_INPUT_MAJOR * 100);
  assert.equal(plan.shortfall, false);
  for (const key of [
    "incomeMinor",
    "billsMinor",
    "debtMinor",
    "essentialsMinor",
    "savingsMinor",
    "committedMinor",
    "leftoverMinor",
  ]) {
    assert.ok(Number.isSafeInteger(plan[key]), `${key} must stay a safe integer`);
  }
});

test("preview ignores amounts above the input cap instead of returning unsafe math", () => {
  assert.equal(monthlyMinor(MAX_INPUT_MAJOR + 1, "daily"), 0);
  const plan = monthlyPreview({
    income: MAX_INPUT_MAJOR + 1,
    frequency: "weekly",
    bills: [MAX_INPUT_MAJOR + 1],
    debt: MAX_INPUT_MAJOR + 1,
    goal: MAX_INPUT_MAJOR + 1,
  });
  assert.equal(plan.incomeMinor, 0);
  assert.equal(plan.billsMinor, 0);
  assert.equal(plan.leftoverMinor, 0);
  assert.equal(plan.shortfall, false);
});
