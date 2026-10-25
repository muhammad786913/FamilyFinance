const test = require("node:test");
const assert = require("node:assert/strict");
const { runPlan, applyScenario, eventAffordability } = require("../lib/engine/planningEngine");

const base = {
  startDate: "2026-10-01",
  endDate: "2026-10-31",
  asOfDate: "2026-10-01",
  startingBalanceMinor: 500000,
  emergencyReserveMinor: 100000,
  weekStartsOn: 1,
};

test("income before bills keeps a positive projected balance", () => {
  const plan = runPlan({
    ...base,
    incomes: [{ id: "s", name: "Salary", amountMinor: 1000000, receivedMinor: 1000000, receivedDate: "2026-10-01", expectedDate: "2026-10-01", status: "received" }],
    expenses: [{ id: "r", name: "Rent", amountMinor: 400000, paidMinor: 0, dueDate: "2026-10-05", essential: true, priority: 1, status: "unpaid" }],
  });
  assert.ok(plan.totals.endingProjectedMinor > 0);
  assert.equal(plan.missedEssentials.length, 0);
});

test("bills before income can flag shortage", () => {
  const plan = runPlan({
    ...base,
    startingBalanceMinor: 0,
    incomes: [{ id: "s", name: "Salary", amountMinor: 1000000, receivedMinor: 0, expectedDate: "2026-10-20", status: "expected" }],
    expenses: [{ id: "r", name: "Rent", amountMinor: 400000, paidMinor: 0, dueDate: "2026-10-05", essential: true, priority: 1, status: "unpaid" }],
  });
  assert.ok(plan.missedEssentials.some((m) => m.label === "Rent"));
  assert.ok(plan.shortages.length > 0);
});

test("irregular and partial income is not double counted", () => {
  const plan = runPlan({
    ...base,
    incomes: [
      {
        id: "f",
        name: "Freelance",
        amountMinor: 300000,
        receivedMinor: 100000,
        receivedDate: "2026-10-04",
        expectedDate: "2026-10-10",
        status: "partial",
      },
    ],
    expenses: [],
  });
  assert.equal(plan.totals.confirmedIncomeMinor, 100000);
  assert.equal(plan.totals.expectedIncomeLeftMinor, 200000);
  const day4 = plan.daily.find((d) => d.date === "2026-10-04");
  const day10 = plan.daily.find((d) => d.date === "2026-10-10");
  assert.equal(day4.endingConfirmedMinor, base.startingBalanceMinor + 100000);
  assert.equal(day10.endingProjectedMinor, base.startingBalanceMinor + 300000);
});

test("partially paid bills use remaining amount only", () => {
  const plan = runPlan({
    ...base,
    expenses: [{ id: "g", name: "Gas", amountMinor: 100000, paidMinor: 40000, paidDate: "2026-10-02", dueDate: "2026-10-08", essential: true, status: "partial" }],
    incomes: [],
  });
  assert.equal(plan.totals.actualSpendMinor, 40000);
  assert.equal(plan.totals.unpaidBillsMinor, 60000);
});

test("negative projected balances are reported", () => {
  const plan = runPlan({
    ...base,
    startingBalanceMinor: 1000,
    emergencyReserveMinor: 0,
    expenses: [{ id: "x", name: "Repair", amountMinor: 50000, paidMinor: 0, dueDate: "2026-10-03", essential: false, status: "unpaid" }],
    incomes: [],
  });
  assert.ok(plan.totals.endingProjectedMinor < 0);
  assert.ok(plan.daily.some((d) => d.shortage));
});

test("delayed expected income is not confirmed cash", () => {
  const plan = runPlan({
    ...base,
    incomes: [{ id: "s", name: "Salary", amountMinor: 800000, receivedMinor: 0, expectedDate: "2026-10-15", status: "delayed", estimated: true }],
    expenses: [],
  });
  assert.equal(plan.totals.endingConfirmedMinor, base.startingBalanceMinor);
  assert.ok(plan.totals.endingProjectedMinor > base.startingBalanceMinor);
});

test("actual spending changes remaining forecast", () => {
  const unpaid = runPlan({
    ...base,
    expenses: [{ id: "e", name: "Food", amountMinor: 200000, paidMinor: 0, dueDate: "2026-10-12", essential: true, status: "unpaid" }],
    incomes: [],
  });
  const paid = runPlan({
    ...base,
    expenses: [{ id: "e", name: "Food", amountMinor: 200000, paidMinor: 200000, paidDate: "2026-10-06", dueDate: "2026-10-12", essential: true, status: "paid" }],
    incomes: [],
  });
  assert.notEqual(unpaid.totals.endingConfirmedMinor, paid.totals.endingConfirmedMinor);
});

test("scenario isolation does not mutate baseline inputs", () => {
  const incomes = [{ id: "s", name: "Salary", amountMinor: 500000, receivedMinor: 0, expectedDate: "2026-10-05", status: "expected" }];
  const input = { ...base, incomes, expenses: [] };
  const simulated = applyScenario(input, { delayIncomeId: "s", delayDays: 10 });
  assert.equal(incomes[0].expectedDate, "2026-10-05");
  assert.ok(simulated.daily.some((d) => d.date === "2026-10-15" && d.events.some((e) => e.id === "s")));
});

test("event affordability simulation does not require real records", () => {
  const result = eventAffordability(
    { ...base, startingBalanceMinor: 10000, emergencyReserveMinor: 0, incomes: [], expenses: [] },
    { name: "Wedding", amountMinor: 5000000, targetDate: "2026-10-20" }
  );
  assert.equal(result.verdict, "currently_unaffordable");
});

test("month-end last day is included", () => {
  const plan = runPlan({ ...base, incomes: [], expenses: [] });
  assert.equal(plan.daily[plan.daily.length - 1].date, "2026-10-31");
});
