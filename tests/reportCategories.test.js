const test = require("node:test");
const assert = require("node:assert/strict");
const { categoryBreakdown, overBudgetCategories } = require("../lib/reportCategories");

test("a cancelled row does not erase an active row in the same category", () => {
  const rows = categoryBreakdown([
    { category: "groceries", amountMinor: 30000, paidMinor: 35000, status: "unpaid" },
    { category: "groceries", amountMinor: 20000, paidMinor: 10000, status: "cancelled" },
  ]);
  assert.deepEqual(rows.groceries, { planned: 30000, actual: 45000 });
  assert.deepEqual(overBudgetCategories(rows), [
    { category: "groceries", planned: 30000, actual: 45000, overMinor: 15000 },
  ]);
});

test("paid cash on a cancelled row still appears in actual spend", () => {
  const rows = categoryBreakdown([
    { category: "medical", amountMinor: 50000, paidMinor: 20000, status: "cancelled" },
  ]);
  assert.deepEqual(rows.medical, { planned: 0, actual: 20000 });
  assert.deepEqual(overBudgetCategories(rows), [
    { category: "medical", planned: 0, actual: 20000, overMinor: 20000 },
  ]);
});

test("categories with no overage are not reported as over budget", () => {
  const rows = categoryBreakdown([
    { category: "rent_housing", amountMinor: 100000, paidMinor: 100000, status: "paid" },
  ]);
  assert.deepEqual(overBudgetCategories(rows), []);
});

test("category totals use the in-period event dates, not just the row's dates", () => {
  const period = { start: "2026-10-01", end: "2026-10-31" };
  const rows = categoryBreakdown(
    [
      // Due this cycle but paid last cycle: planned stays, actual does not.
      { category: "old_payment", amountMinor: 20000, paidMinor: 5000, dueDate: "2026-10-10", paidDate: "2026-09-25", status: "paid" },
      // Paid this cycle but due next cycle: actual stays, planned does not.
      { category: "next_due", amountMinor: 30000, paidMinor: 7000, dueDate: "2026-11-02", paidDate: "2026-10-05", status: "partial" },
      // Legacy row without a payment date falls back to its due date.
      { category: "legacy", amountMinor: 10000, paidMinor: 3000, dueDate: "2026-10-12", paidDate: null, status: "partial" },
    ],
    period
  );
  assert.deepEqual(rows.old_payment, { planned: 20000, actual: 0 });
  assert.deepEqual(rows.next_due, { planned: 0, actual: 7000 });
  assert.deepEqual(rows.legacy, { planned: 10000, actual: 3000 });
  assert.deepEqual(overBudgetCategories(rows), [
    { category: "next_due", planned: 0, actual: 7000, overMinor: 7000 },
  ]);
});
