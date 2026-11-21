const { moneyField, nonNegativeNumberField, nonNegativeIntegerField, ymd } = require("./validation");

function hasInput(value) {
  return value != null && String(value).trim() !== "";
}

function bad(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function buildScenarioPayload(body, period) {
  const hasExtraAmount = hasInput(body.extraAmount);
  const hasMultiplier = hasInput(body.expenseMultiplier);
  const extraDate = hasExtraAmount ? ymd(body.extraDate || period.start, "extra date") : null;
  if (extraDate && (extraDate < period.start || extraDate > period.end)) {
    throw bad("The simulated expense date must be inside the selected planning period.");
  }

  return {
    delayIncomeId: body.delayIncomeId || null,
    delayDays: nonNegativeIntegerField(body.delayDays, "delay days"),
    incomeAmountId: body.incomeAmountId || null,
    incomeAmountMinor: body.incomeAmount != null ? moneyField(body.incomeAmount) : null,
    expenseCategory: body.expenseCategory || null,
    expenseMultiplier: hasMultiplier
      ? nonNegativeNumberField(body.expenseMultiplier, "expense multiplier")
      : null,
    extraExpense: hasExtraAmount
      ? {
          id: "sim-extra",
          name: String(body.extraName || "Unexpected expense").slice(0, 120),
          amountMinor: moneyField(body.extraAmount, "extra amount"),
          dueDate: extraDate,
          essential: !!body.extraEssential,
          priority: 3,
        }
      : null,
  };
}

module.exports = { buildScenarioPayload };
