const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
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
  const events = plan.daily.flatMap((d) => d.events).filter((e) => e.id === "f");
  assert.deepEqual(events.map((e) => [e.date, e.amountMinor, e.confirmed]), [
    ["2026-10-04", 100000, true],
    ["2026-10-10", 200000, false],
  ]);
  assert.equal(events.reduce((sum, e) => sum + e.amountMinor, 0), 300000);
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

test("status-aware totals reconcile with the day-by-day plan", () => {
  const plan = runPlan({
    ...base,
    incomes: [
      { id: "ok", name: "Received", amountMinor: 500000, receivedMinor: 500000, receivedDate: "2026-10-02", expectedDate: "2026-10-02", status: "received" },
      { id: "part", name: "Partial", amountMinor: 400000, receivedMinor: 150000, receivedDate: "2026-10-04", expectedDate: "2026-10-10", status: "partial" },
      { id: "late", name: "Delayed", amountMinor: 300000, receivedMinor: 0, expectedDate: "2026-10-12", status: "delayed" },
      { id: "gone", name: "Cancelled", amountMinor: 200000, receivedMinor: 0, expectedDate: "2026-10-14", status: "cancelled" },
    ],
    expenses: [
      { id: "paid", name: "Paid bill", amountMinor: 100000, paidMinor: 100000, paidDate: "2026-10-03", dueDate: "2026-10-03", status: "paid" },
      { id: "due", name: "Due bill", amountMinor: 80000, paidMinor: 0, dueDate: "2026-10-09", status: "unpaid" },
      { id: "void", name: "Cancelled bill", amountMinor: 70000, paidMinor: 0, dueDate: "2026-10-11", status: "cancelled" },
    ],
  });
  const t = plan.totals;
  assert.equal(t.confirmedIncomeMinor, 650000);
  assert.equal(t.expectedIncomeLeftMinor, 250000);
  assert.equal(t.actualSpendMinor, 100000);
  assert.equal(t.unpaidBillsMinor, 80000);
  assert.equal(
    t.endingProjectedMinor,
    base.startingBalanceMinor + t.confirmedIncomeMinor + t.expectedIncomeLeftMinor - t.actualSpendMinor - t.unpaidBillsMinor
  );
  assert.equal(
    t.endingConfirmedMinor,
    base.startingBalanceMinor + t.confirmedIncomeMinor - t.actualSpendMinor
  );
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

test("delayed expected income leaves both available balances unchanged", () => {
  const plan = runPlan({
    ...base,
    incomes: [{ id: "s", name: "Salary", amountMinor: 800000, receivedMinor: 0, expectedDate: "2026-10-15", status: "delayed", estimated: true }],
    expenses: [],
  });
  assert.equal(plan.totals.endingConfirmedMinor, base.startingBalanceMinor);
  assert.equal(plan.totals.endingProjectedMinor, base.startingBalanceMinor);
  assert.equal(plan.totals.expectedIncomeLeftMinor, 0);
  assert.equal(plan.daily.flatMap((d) => d.events).filter((e) => e.id === "s").length, 0);
});

test("delayed income keeps real receipts but drops the unpaid projection", () => {
  const plan = runPlan({
    ...base,
    incomes: [{
      id: "s",
      name: "Salary",
      amountMinor: 800000,
      receivedMinor: 200000,
      receivedDate: "2026-10-04",
      expectedDate: "2026-10-15",
      status: "delayed",
    }],
    expenses: [],
  });
  assert.equal(plan.totals.confirmedIncomeMinor, 200000);
  assert.equal(plan.totals.expectedIncomeLeftMinor, 0);
  assert.equal(plan.totals.endingConfirmedMinor, base.startingBalanceMinor + 200000);
  assert.equal(plan.totals.endingProjectedMinor, base.startingBalanceMinor + 200000);
  assert.deepEqual(plan.daily.flatMap((d) => d.events).filter((e) => e.id === "s").map((e) => e.amountMinor), [200000]);
});

test("cancelled income drops its future projection but keeps received cash", () => {
  const plan = runPlan({
    ...base,
    incomes: [{
      id: "s",
      name: "Salary",
      amountMinor: 900000,
      receivedMinor: 300000,
      receivedDate: "2026-10-04",
      expectedDate: "2026-10-20",
      status: "cancelled",
    }],
    expenses: [],
  });
  assert.equal(plan.totals.confirmedIncomeMinor, 300000);
  assert.equal(plan.totals.expectedIncomeLeftMinor, 0);
  assert.equal(plan.totals.endingConfirmedMinor, base.startingBalanceMinor + 300000);
  assert.equal(plan.totals.endingProjectedMinor, base.startingBalanceMinor + 300000);
  assert.deepEqual(plan.daily.flatMap((d) => d.events).filter((e) => e.id === "s").map((e) => e.amountMinor), [300000]);
});

test("cancelled income with no receipt is fully excluded", () => {
  const plan = runPlan({
    ...base,
    incomes: [{ id: "s", name: "Salary", amountMinor: 900000, receivedMinor: 0, expectedDate: "2026-10-20", status: "cancelled" }],
    expenses: [],
  });
  assert.equal(plan.totals.confirmedIncomeMinor, 0);
  assert.equal(plan.totals.expectedIncomeLeftMinor, 0);
  assert.equal(plan.totals.endingProjectedMinor, base.startingBalanceMinor);
  assert.equal(plan.daily.flatMap((d) => d.events).filter((e) => e.id === "s").length, 0);
});

test("cancelled expense keeps paid cash but drops the unpaid remainder", () => {
  const plan = runPlan({
    ...base,
    expenses: [{
      id: "g",
      name: "Gas",
      amountMinor: 300000,
      paidMinor: 100000,
      paidDate: "2026-10-02",
      dueDate: "2026-10-08",
      essential: true,
      status: "cancelled",
    }],
    incomes: [],
  });
  assert.equal(plan.totals.actualSpendMinor, 100000);
  assert.equal(plan.totals.unpaidBillsMinor, 0);
  assert.equal(plan.totals.endingConfirmedMinor, base.startingBalanceMinor - 100000);
  assert.equal(plan.totals.endingProjectedMinor, base.startingBalanceMinor - 100000);
  assert.deepEqual(plan.daily.flatMap((d) => d.events).filter((e) => e.id === "g").map((e) => e.amountMinor), [100000]);
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

test("a zero suggested spend reports why it is zero", () => {
  const noCash = runPlan({
    ...base,
    startingBalanceMinor: 0,
    emergencyReserveMinor: 0,
    incomes: [],
    expenses: [],
  });
  assert.equal(noCash.daily[0].suggestedDiscretionaryMinor, 0);
  assert.equal(noCash.daily[0].suggestedBlocker, "no_cash");

  const reserve = runPlan({
    ...base,
    startingBalanceMinor: 50000,
    emergencyReserveMinor: 100000,
    incomes: [],
    expenses: [],
  });
  assert.equal(reserve.daily[0].suggestedBlocker, "reserve");

  const essentials = runPlan({
    ...base,
    startingBalanceMinor: 500000,
    emergencyReserveMinor: 0,
    incomes: [],
    expenses: [
      { id: "r", name: "Rent", amountMinor: 500000, paidMinor: 0, dueDate: "2026-10-05", essential: true, status: "unpaid" },
    ],
  });
  assert.equal(essentials.daily[0].suggestedBlocker, "essentials");

  const tooSmall = runPlan({
    ...base,
    startingBalanceMinor: 10,
    emergencyReserveMinor: 0,
    incomes: [],
    expenses: [],
  });
  assert.equal(tooSmall.daily[0].suggestedBlocker, "too_small");

  const positive = runPlan({
    ...base,
    startingBalanceMinor: 310000,
    emergencyReserveMinor: 0,
    incomes: [],
    expenses: [],
  });
  assert.ok(positive.daily[0].suggestedDiscretionaryMinor > 0);
  assert.equal(positive.daily[0].suggestedBlocker, null);
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


test("scenario can set a category expense multiplier to zero", () => {
  const input = {
    ...base,
    expenses: [
      { id: "g1", name: "Groceries", category: "groceries", amountMinor: 25000, dueDate: "2026-10-10", essential: true, paidMinor: 0, status: "unpaid" },
    ],
    incomes: [],
  };
  const baseline = runPlan(input);
  const simulated = applyScenario(input, { expenseCategory: "groceries", expenseMultiplier: 0 });
  assert.equal(simulated.totals.endingProjectedMinor - baseline.totals.endingProjectedMinor, 25000);
});

test("maximum supported starting balance calculates exactly", () => {
  const maxMinor = Number.MAX_SAFE_INTEGER;
  const plan = runPlan({ ...base, startingBalanceMinor: maxMinor, emergencyReserveMinor: 0, incomes: [], expenses: [] });
  assert.equal(plan.totals.endingProjectedMinor, maxMinor);
});

test("engine rejects totals that overflow safe paisa calculations", () => {
  assert.throws(
    () => runPlan({
      ...base,
      startingBalanceMinor: Number.MAX_SAFE_INTEGER,
      emergencyReserveMinor: 0,
      incomes: [{ id: "i", name: "Income", amountMinor: 1, receivedMinor: 0, expectedDate: "2026-10-02", status: "expected" }],
      expenses: [],
    }),
    /Projected balance exceeds/
  );
});


test("scenario delay rejects dates outside the supported calendar range", () => {
  const input = {
    ...base,
    incomes: [{ id: "i", name: "Salary", amountMinor: 1000, receivedMinor: 0, expectedDate: "2026-10-10", status: "expected" }],
    expenses: [],
  };
  assert.throws(
    () => applyScenario(input, { delayIncomeId: "i", delayDays: Number.MAX_SAFE_INTEGER }),
    /supported date range/
  );
});

test("a receipt in another cycle is not counted in this cycle's totals", () => {
  const plan = runPlan({
    ...base,
    incomes: [
      {
        id: "old",
        name: "September receipt",
        amountMinor: 50000,
        receivedMinor: 50000,
        receivedDate: "2026-09-20",
        expectedDate: "2026-10-15",
        status: "received",
      },
    ],
    expenses: [],
  });
  assert.equal(plan.totals.confirmedIncomeMinor, 0);
  assert.equal(plan.totals.expectedIncomeLeftMinor, 0);
  assert.equal(plan.totals.endingProjectedMinor, base.startingBalanceMinor);
  assert.deepEqual(plan.daily.flatMap((day) => day.events), []);
});

test("a partial receipt keeps only the in-cycle projected remainder", () => {
  const plan = runPlan({
    ...base,
    startingBalanceMinor: 0,
    emergencyReserveMinor: 0,
    incomes: [
      {
        id: "partial",
        name: "Partly received",
        amountMinor: 50000,
        receivedMinor: 20000,
        receivedDate: "2026-09-20",
        expectedDate: "2026-10-15",
        status: "partial",
      },
    ],
    expenses: [],
  });
  assert.equal(plan.totals.confirmedIncomeMinor, 0);
  assert.equal(plan.totals.expectedIncomeLeftMinor, 30000);
  assert.equal(plan.totals.endingProjectedMinor, 30000);
  assert.deepEqual(
    plan.daily.flatMap((day) => day.events).map((event) => [event.date, event.amountMinor, event.confirmed]),
    [["2026-10-15", 30000, false]]
  );
});

test("a payment dated in another cycle is not counted as this cycle's spend", () => {
  const plan = runPlan({
    ...base,
    expenses: [
      {
        id: "old-bill",
        name: "Paid last month",
        amountMinor: 30000,
        paidMinor: 30000,
        paidDate: "2026-09-25",
        dueDate: "2026-10-10",
        status: "paid",
      },
    ],
    incomes: [],
  });
  assert.equal(plan.totals.actualSpendMinor, 0);
  assert.equal(plan.totals.unpaidBillsMinor, 0);
  assert.deepEqual(plan.daily.flatMap((day) => day.events), []);
});

test("a real receipt without a payment date still counts on its planned date", () => {
  const plan = runPlan({
    ...base,
    startingBalanceMinor: 0,
    emergencyReserveMinor: 0,
    incomes: [
      {
        id: "legacy",
        name: "Legacy receipt",
        amountMinor: 50000,
        receivedMinor: 50000,
        receivedDate: null,
        expectedDate: "2026-10-15",
        status: "received",
      },
    ],
    expenses: [],
  });
  assert.equal(plan.totals.confirmedIncomeMinor, 50000);
  assert.deepEqual(
    plan.daily.flatMap((day) => day.events).map((event) => [event.date, event.confirmed]),
    [["2026-10-15", true]]
  );
});

test("safe-to-spend ignores a confirmed income dated after the plan", () => {
  const common = { ...base, startingBalanceMinor: 100000, emergencyReserveMinor: 0, expenses: [] };
  const without = runPlan({ ...common, incomes: [] });
  const withOffPeriod = runPlan({
    ...common,
    incomes: [
      {
        id: "future",
        name: "Next month receipt",
        amountMinor: 50000,
        receivedMinor: 50000,
        receivedDate: "2026-11-05",
        expectedDate: "2026-10-01",
        status: "received",
      },
    ],
  });
  assert.equal(withOffPeriod.daily[0].nextConfirmedIncomeDate, null);
  assert.equal(withOffPeriod.daily[0].suggestedSpanDays, without.daily[0].suggestedSpanDays);
  assert.equal(withOffPeriod.daily[0].suggestedDiscretionaryMinor, without.daily[0].suggestedDiscretionaryMinor);
});

test("an event outside the selected period gets an explicit verdict", () => {
  const result = eventAffordability(
    { ...base, startingBalanceMinor: 10_000_000, emergencyReserveMinor: 0, incomes: [], expenses: [] },
    { name: "Wedding", amountMinor: 1000, targetDate: "2026-11-15" }
  );
  assert.equal(result.verdict, "outside_planning_period");
  assert.deepEqual(result.simulated.totals, result.baseline.totals);
  assert.equal(result.alternatives.length, 3);

  const eventsPage = fs.readFileSync(path.join(__dirname, "../app/(app)/events/page.js"), "utf8");
  assert.match(eventsPage, /outside_planning_period:\s*"Outside this planning period"/);
});
