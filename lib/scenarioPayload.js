const { moneyField, nonNegativeNumberField, nonNegativeIntegerField, ymd } = require("./validation");

function hasInput(value) {
  return value != null && String(value).trim() !== "";
}

function buildScenarioPayload(body, period) {
  const hasExtraAmount = hasInput(body.extraAmount);
  const hasMultiplier = hasInput(body.expenseMultiplier);

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
          dueDate: ymd(body.extraDate || period.start),
          essential: !!body.extraEssential,
          priority: 3,
        }
      : null,
  };
}

module.exports = { buildScenarioPayload };
