/** Pure report category math shared by the API and unit tests. */

function inRange(date, period) {
  if (!period) return true;
  return !!date && date >= period.start && date <= period.end;
}

function categoryBreakdown(expenses, period = null) {
  const byCategory = {};
  for (const expense of expenses) {
    const row = byCategory[expense.category] || { planned: 0, actual: 0 };
    const paymentDate = expense.paidDate || expense.dueDate;
    // Only a cancelled row leaves planned totals; its paid cash still counts.
    // Both sides are tied to the event date so a payment recorded in another
    // cycle cannot appear in this cycle's category totals.
    if (expense.status !== "cancelled" && inRange(expense.dueDate, period)) {
      row.planned += expense.amountMinor || 0;
    }
    if ((expense.paidMinor || 0) > 0 && inRange(paymentDate, period)) {
      row.actual += expense.paidMinor || 0;
    }
    byCategory[expense.category] = row;
  }
  return byCategory;
}

function overBudgetCategories(byCategory) {
  return Object.entries(byCategory)
    .filter(([, row]) => row.actual > row.planned)
    .map(([category, row]) => ({ category, ...row, overMinor: row.actual - row.planned }));
}

module.exports = { categoryBreakdown, overBudgetCategories };
