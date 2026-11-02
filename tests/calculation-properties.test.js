const test = require("node:test");
const assert = require("node:assert/strict");
const { MAX_INPUT_MAJOR } = require("../lib/money");
const { monthlyPreview } = require("../lib/onboardingPlan");
const { runPlan } = require("../lib/engine/planningEngine");
const { addDays, enumerateDays } = require("../lib/dates");

/** Deterministic mulberry32 PRNG so failures are reproducible. */
function prng(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const money = (rnd) => Math.round(rnd() * MAX_INPUT_MAJOR * 100) / 100;
const whole = (rnd, max) => Math.floor(rnd() * (max + 1));
const FREQUENCIES = ["monthly", "weekly", "daily", "yearly"];
const PREVIEW_KEYS = [
  "incomeMinor",
  "billsMinor",
  "debtMinor",
  "essentialsMinor",
  "savingsMinor",
  "committedMinor",
  "leftoverMinor",
];

function monthlyValue(minor, frequency) {
  if (frequency === "weekly") return Number((BigInt(minor) * 52n + 6n) / 12n);
  if (frequency === "daily") return Number((BigInt(minor) * 365n + 6n) / 12n);
  if (frequency === "yearly") return Number((BigInt(minor) + 6n) / 12n);
  return minor;
}

test("every allowed onboarding value previews to the same exact paisa total", () => {
  const rnd = prng(20261102);
  for (let index = 0; index < 600; index += 1) {
    const income = money(rnd);
    const frequency = FREQUENCIES[whole(rnd, FREQUENCIES.length - 1)];
    const bills = Array.from({ length: whole(rnd, 8) }, () => money(rnd));
    const debt = money(rnd);
    const goal = money(rnd);
    const preview = monthlyPreview({ income, frequency, bills, debt, goal });

    const incomeMinor = Math.round(income * 100);
    const billMinor = bills.reduce((sum, value) => sum + BigInt(Math.round(value * 100)), 0n);
    const debtMinor = BigInt(Math.round(debt * 100));
    const goalMinor = BigInt(Math.round(goal * 100));
    const essentialsMinor = billMinor + debtMinor;
    const committedMinor = essentialsMinor + goalMinor;

    assert.equal(preview.incomeMinor, monthlyValue(incomeMinor, frequency));
    assert.equal(preview.billsMinor, Number(billMinor));
    assert.equal(preview.debtMinor, Number(debtMinor));
    assert.equal(preview.essentialsMinor, Number(essentialsMinor));
    assert.equal(preview.savingsMinor, Number(goalMinor));
    assert.equal(preview.committedMinor, Number(committedMinor));
    assert.equal(preview.leftoverMinor, preview.incomeMinor - Number(committedMinor));
    assert.equal(preview.shortfall, preview.incomeMinor < Number(committedMinor));
    for (const key of PREVIEW_KEYS) {
      assert.ok(Number.isSafeInteger(preview[key]), `${key} must be a safe integer`);
    }
  }
});

test("random allowed monthly plans keep every total identity exact", () => {
  const rnd = prng(424242);
  for (let index = 0; index < 400; index += 1) {
    const startDate = addDays("2026-01-01", whole(rnd, 300));
    const days = 28 + whole(rnd, 3);
    const endDate = addDays(startDate, days - 1);
    const startingBalanceMinor = whole(rnd, MAX_INPUT_MAJOR * 100);
    const emergencyReserveMinor = whole(rnd, MAX_INPUT_MAJOR * 100);
    const incomes = Array.from({ length: whole(rnd, 8) }, (_, n) => {
      const amountMinor = whole(rnd, MAX_INPUT_MAJOR * 100);
      const receivedMinor = rnd() < 0.5 ? 0 : whole(rnd, amountMinor);
      const expectedDate = addDays(startDate, whole(rnd, days - 1));
      return {
        id: `in-${index}-${n}`,
        name: `Income ${n}`,
        amountMinor,
        receivedMinor,
        expectedDate,
        receivedDate: receivedMinor > 0 ? expectedDate : undefined,
        status: receivedMinor >= amountMinor ? "received" : "expected",
        estimated: true,
      };
    });
    const expenses = Array.from({ length: whole(rnd, 8) }, (_, n) => {
      const amountMinor = whole(rnd, MAX_INPUT_MAJOR * 100);
      const paidMinor = rnd() < 0.5 ? 0 : whole(rnd, amountMinor);
      const dueDate = addDays(startDate, whole(rnd, days - 1));
      return {
        id: `ex-${index}-${n}`,
        name: `Bill ${n}`,
        amountMinor,
        paidMinor,
        dueDate,
        paidDate: paidMinor > 0 ? dueDate : undefined,
        status: paidMinor >= amountMinor ? "paid" : "unpaid",
        essential: rnd() < 0.5,
        priority: 1 + whole(rnd, 4),
      };
    });

    const plan = runPlan({ startDate, endDate, startingBalanceMinor, emergencyReserveMinor, incomes, expenses });
    const totals = plan.totals;
    assert.equal(plan.daily.length, enumerateDays(startDate, endDate).length);
    assert.equal(totals.endingProjectedMinor, totals.endingConfirmedMinor + totals.expectedIncomeLeftMinor - totals.unpaidBillsMinor);
    assert.equal(totals.endingConfirmedMinor, startingBalanceMinor + totals.confirmedIncomeMinor - totals.actualSpendMinor);
    assert.equal(totals.projectedSurplusMinor, totals.endingProjectedMinor - emergencyReserveMinor);
    assert.equal(totals.confirmedIncomeMinor, incomes.reduce((sum, item) => sum + item.receivedMinor, 0));
    assert.equal(totals.expectedIncomeLeftMinor, incomes.reduce((sum, item) => sum + item.amountMinor - item.receivedMinor, 0));
    assert.equal(totals.actualSpendMinor, expenses.reduce((sum, item) => sum + item.paidMinor, 0));
    assert.equal(totals.unpaidBillsMinor, expenses.reduce((sum, item) => sum + item.amountMinor - item.paidMinor, 0));
    for (const key of Object.keys(totals)) {
      assert.ok(Number.isSafeInteger(totals[key]), `${key} must be a safe integer`);
    }

    let previous = startingBalanceMinor;
    for (const day of plan.daily) {
      assert.equal(day.startingProjectedMinor, previous);
      const delta = day.events.reduce(
        (sum, event) => sum + (event.type === "income" ? event.amountMinor : -event.amountMinor),
        0
      );
      assert.equal(day.endingProjectedMinor, day.startingProjectedMinor + delta);
      previous = day.endingProjectedMinor;
    }
    assert.equal(previous, totals.endingProjectedMinor);
  }
});

test("a full month of daily income at the input cap stays exact", () => {
  const amountMinor = MAX_INPUT_MAJOR * 100;
  const startDate = "2026-01-01";
  const endDate = "2026-01-31";
  const startingBalanceMinor = amountMinor;
  const incomes = enumerateDays(startDate, endDate).map((date, index) => ({
    id: `daily-${index}`,
    name: "Daily wage",
    amountMinor,
    receivedMinor: 0,
    expectedDate: date,
    status: "expected",
    estimated: true,
  }));
  const plan = runPlan({
    startDate,
    endDate,
    startingBalanceMinor,
    emergencyReserveMinor: 0,
    incomes,
    expenses: [],
  });
  assert.equal(plan.totals.expectedIncomeLeftMinor, amountMinor * 31);
  assert.equal(plan.totals.endingProjectedMinor, startingBalanceMinor + amountMinor * 31);
  assert.ok(Number.isSafeInteger(plan.totals.expectedIncomeLeftMinor));
  assert.ok(Number.isSafeInteger(plan.totals.endingProjectedMinor));
});
