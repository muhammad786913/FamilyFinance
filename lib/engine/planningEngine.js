const { enumerateDays, addDays, weekStart, inRange } = require("../dates");

function calculationError(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function assertSafeMinor(value, label = "money amount") {
  const amount = value == null ? 0 : value;
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw calculationError(`Invalid ${label}; use a non-negative amount within the supported limit.`);
  }
  return amount;
}

function addSafeMinor(total, amount, label = "calculation") {
  const next = total + amount;
  if (!Number.isSafeInteger(next)) {
    throw calculationError(`${label} exceeds the supported calculation limit.`);
  }
  return next;
}

function subtractSafeMinor(total, amount, label = "calculation") {
  return addSafeMinor(total, -amount, label);
}

function remaining(planned, actual) {
  const plannedMinor = assertSafeMinor(planned, "planned amount");
  const actualMinor = assertSafeMinor(actual, "paid or received amount");
  return Math.max(0, plannedMinor - actualMinor);
}

function buildEvents({ startDate, endDate, incomes, expenses }) {
  const events = [];
  for (const inc of incomes) {
    if (inc.status === "cancelled") continue;
    const received = inc.receivedMinor || 0;
    if (received > 0 && inc.receivedDate && inRange(inc.receivedDate, startDate, endDate)) {
      events.push({
        date: inc.receivedDate,
        seq: 0,
        type: "income",
        confirmed: true,
        amountMinor: received,
        id: inc.id,
        label: inc.name,
        uncertain: false,
      });
    }
    const left = remaining(inc.amountMinor, received);
    if (left > 0 && inc.expectedDate && inRange(inc.expectedDate, startDate, endDate)) {
      events.push({
        date: inc.expectedDate,
        seq: 0,
        type: "income",
        confirmed: false,
        amountMinor: left,
        id: inc.id,
        label: inc.name,
        uncertain: inc.estimated !== false,
      });
    }
  }
  for (const exp of expenses) {
    if (exp.status === "cancelled") continue;
    const paid = exp.paidMinor || 0;
    if (paid > 0 && exp.paidDate && inRange(exp.paidDate, startDate, endDate)) {
      events.push({
        date: exp.paidDate,
        seq: 10 + (exp.priority || 5),
        type: "expense",
        confirmed: true,
        amountMinor: paid,
        id: exp.id,
        label: exp.name,
        essential: !!exp.essential,
        category: exp.category,
      });
    }
    const left = remaining(exp.amountMinor, paid);
    if (left > 0 && exp.dueDate && inRange(exp.dueDate, startDate, endDate)) {
      events.push({
        date: exp.dueDate,
        seq: 10 + (exp.priority || 5),
        type: "expense",
        confirmed: false,
        amountMinor: left,
        id: exp.id,
        label: exp.name,
        essential: !!exp.essential,
        category: exp.category,
      });
    }
  }
  events.sort((a, b) => a.date.localeCompare(b.date) || a.seq - b.seq || a.label.localeCompare(b.label));
  return events;
}

function nextConfirmedIncomeDate(incomes, afterDate) {
  const dates = incomes
    .filter((i) => i.status !== "cancelled" && i.receivedMinor > 0 && i.receivedDate && i.receivedDate > afterDate)
    .map((i) => i.receivedDate)
    .sort();
  const expectedConfirmed = incomes
    .filter((i) => i.status === "received" && i.expectedDate && i.expectedDate > afterDate)
    .map((i) => i.expectedDate);
  return [...dates, ...expectedConfirmed].sort()[0] || null;
}

function sumEssentialsDue(expenses, fromDate, toDate) {
  let total = 0;
  for (const exp of expenses) {
    if (!exp.essential || exp.status === "cancelled") continue;
    const left = remaining(exp.amountMinor, exp.paidMinor);
    if (left > 0 && exp.dueDate >= fromDate && exp.dueDate <= toDate) {
      total = addSafeMinor(total, left, "Upcoming essentials total");
    }
  }
  return total;
}

function runPlan(input) {
  const {
    startDate,
    endDate,
    asOfDate = startDate,
    startingBalanceMinor = 0,
    emergencyReserveMinor = 0,
    incomes = [],
    expenses = [],
    weekStartsOn = 1,
  } = input;

  assertSafeMinor(startingBalanceMinor, "starting balance");
  assertSafeMinor(emergencyReserveMinor, "emergency reserve");
  for (const income of incomes) {
    assertSafeMinor(income.amountMinor, "income amount");
    assertSafeMinor(income.receivedMinor, "received income");
  }
  for (const expense of expenses) {
    assertSafeMinor(expense.amountMinor, "expense amount");
    assertSafeMinor(expense.paidMinor, "paid expense");
  }

  const events = buildEvents({ startDate, endDate, incomes, expenses });
  const days = enumerateDays(startDate, endDate);
  const explanations = [
    `Starting balance ${startingBalanceMinor} minor units on ${startDate}.`,
    `Emergency reserve target ${emergencyReserveMinor}. Expected income is projected until received.`,
  ];
  const shortages = [];
  const missedEssentials = [];
  const daily = [];
  let confirmed = startingBalanceMinor;
  let projected = startingBalanceMinor;
  let idx = 0;
  const seenShortage = new Set();

  function noteShortage(key, row) {
    if (seenShortage.has(key)) return;
    seenShortage.add(key);
    shortages.push(row);
  }

  for (const day of days) {
    const startProjected = projected;
    const startConfirmed = confirmed;
    const dayEvents = [];
    while (idx < events.length && events[idx].date === day) {
      const ev = events[idx++];
      if (ev.type === "income") {
        projected = addSafeMinor(projected, ev.amountMinor, "Projected balance");
        if (ev.confirmed) confirmed = addSafeMinor(confirmed, ev.amountMinor, "Confirmed balance");
        explanations.push(
          `${day}: ${ev.confirmed ? "confirmed" : "projected"} income "${ev.label}" +${ev.amountMinor}.`
        );
      } else {
        if (projected < ev.amountMinor) {
          noteShortage(`${day}:${ev.id}:short`, {
            date: day,
            kind: ev.essential ? "essential" : "expense",
            id: ev.id,
            label: ev.label,
            shortfallMinor: subtractSafeMinor(ev.amountMinor, projected, "Shortfall calculation"),
            confirmed: ev.confirmed,
          });
          if (ev.essential && !ev.confirmed) {
            missedEssentials.push({
              date: day,
              id: ev.id,
              label: ev.label,
              amountMinor: ev.amountMinor,
              availableProjectedMinor: projected,
            });
            explanations.push(`${day}: essential "${ev.label}" may be missed; projected cash ${projected}.`);
          }
        }
        projected = subtractSafeMinor(projected, ev.amountMinor, "Projected balance");
        if (ev.confirmed) confirmed = subtractSafeMinor(confirmed, ev.amountMinor, "Confirmed balance");
        explanations.push(`${day}: ${ev.confirmed ? "paid" : "due"} "${ev.label}" -${ev.amountMinor}.`);
      }
      dayEvents.push(ev);
      if (projected < emergencyReserveMinor) {
        noteShortage(`${day}:reserve`, {
          date: day,
          kind: "reserve",
          label: "Emergency reserve at risk",
          shortfallMinor: subtractSafeMinor(emergencyReserveMinor, projected, "Reserve shortfall calculation"),
          confirmed: false,
        });
      }
    }

    const horizon = nextConfirmedIncomeDate(incomes, day) || endDate;
    const essentialsAhead = sumEssentialsDue(expenses, day, horizon);
    const safePool = subtractSafeMinor(
      subtractSafeMinor(confirmed, emergencyReserveMinor, "Safe-to-spend calculation"),
      essentialsAhead,
      "Safe-to-spend calculation"
    );
    const spanDays = Math.max(1, enumerateDays(day, horizon).length);
    const suggestedDiscretionaryMinor = safePool <= 0 ? 0 : Math.floor(safePool / spanDays);

    daily.push({
      date: day,
      startingProjectedMinor: startProjected,
      startingConfirmedMinor: startConfirmed,
      endingProjectedMinor: projected,
      endingConfirmedMinor: confirmed,
      events: dayEvents,
      suggestedDiscretionaryMinor,
      suggestedIsEstimate: true,
      safePoolMinor: safePool,
      nextConfirmedIncomeDate: nextConfirmedIncomeDate(incomes, day),
      shortage: projected < 0,
    });
  }

  const weeks = [];
  const ws = weekStartsOn;
  for (const day of daily) {
    const start = weekStart(day.date, ws);
    let week = weeks.find((w) => w.start === start);
    if (!week) {
      week = {
        start,
        end: addDays(start, 6),
        days: [],
        startingProjectedMinor: day.startingProjectedMinor,
        shortages: 0,
      };
      weeks.push(week);
    }
    week.days.push(day);
    week.endingProjectedMinor = day.endingProjectedMinor;
    week.endingConfirmedMinor = day.endingConfirmedMinor;
    if (day.shortage) week.shortages += 1;
  }

  const last = daily[daily.length - 1];
  const confirmedIncome = incomes.reduce((sum, income) => addSafeMinor(sum, income.receivedMinor || 0, "Confirmed income total"), 0);
  const expectedIncomeLeft = incomes.reduce((sum, income) => addSafeMinor(sum, remaining(income.amountMinor, income.receivedMinor), "Expected income total"), 0);
  const actualSpend = expenses.reduce((sum, expense) => addSafeMinor(sum, expense.paidMinor || 0, "Actual spending total"), 0);
  const unpaid = expenses.reduce((sum, expense) => addSafeMinor(sum, remaining(expense.amountMinor, expense.paidMinor), "Unpaid expense total"), 0);
  const monthEndProjected = last ? last.endingProjectedMinor : startingBalanceMinor;
  const surplusProjected = subtractSafeMinor(monthEndProjected, emergencyReserveMinor, "Projected surplus");

  return {
    startDate,
    endDate,
    asOfDate,
    startingBalanceMinor,
    emergencyReserveMinor,
    daily,
    weeks,
    shortages,
    missedEssentials,
    explanations,
    totals: {
      confirmedIncomeMinor: confirmedIncome,
      expectedIncomeLeftMinor: expectedIncomeLeft,
      actualSpendMinor: actualSpend,
      unpaidBillsMinor: unpaid,
      endingConfirmedMinor: last ? last.endingConfirmedMinor : startingBalanceMinor,
      endingProjectedMinor: monthEndProjected,
      projectedSurplusMinor: surplusProjected,
    },
    assumptions: [
      "Received income is added once, on the received date.",
      "Unreceived income is projected on the expected date and is not treated as cash in hand.",
      "Unpaid bills stay on their original due date; due dates are never shifted automatically.",
      "Suggested daily spending is an estimate after reserve and upcoming essentials until the next confirmed income.",
      "Projections are not guaranteed outcomes.",
    ],
  };
}

function applyScenario(base, scenario = {}) {
  const incomes = JSON.parse(JSON.stringify(base.incomes || []));
  const expenses = JSON.parse(JSON.stringify(base.expenses || []));
  if (scenario.delayIncomeId && scenario.delayDays) {
    const inc = incomes.find((i) => i.id === scenario.delayIncomeId);
    if (inc && inc.expectedDate) {
      try {
        const delayedDate = addDays(inc.expectedDate, scenario.delayDays);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(delayedDate)) throw new Error("Invalid date range");
        inc.expectedDate = delayedDate;
      } catch {
        throw calculationError("The delay moves income outside the supported date range.");
      }
    }
  }
  if (scenario.incomeAmountId != null && scenario.incomeAmountMinor != null) {
    const inc = incomes.find((i) => i.id === scenario.incomeAmountId);
    if (inc) inc.amountMinor = scenario.incomeAmountMinor;
  }
  if (scenario.expenseMultiplier != null && scenario.expenseCategory) {
    if (!Number.isFinite(scenario.expenseMultiplier) || scenario.expenseMultiplier < 0) {
      const error = new Error("Expense multiplier must be a valid non-negative number.");
      error.status = 400;
      throw error;
    }
    for (const exp of expenses) {
      if (exp.category === scenario.expenseCategory) {
        const adjustedMinor = Math.round(exp.amountMinor * scenario.expenseMultiplier);
        if (!Number.isSafeInteger(adjustedMinor)) {
          const error = new Error("Simulated expense exceeds the supported amount limit.");
          error.status = 400;
          throw error;
        }
        exp.amountMinor = adjustedMinor;
      }
    }
  }
  if (scenario.extraExpense) expenses.push({ ...scenario.extraExpense, paidMinor: 0, status: "unpaid" });
  if (scenario.extraIncome) incomes.push({ ...scenario.extraIncome, receivedMinor: 0, status: "expected" });
  return runPlan({ ...base, incomes, expenses });
}

function comparePlans(baseline, simulated) {
  return {
    endingProjectedDeltaMinor: subtractSafeMinor(simulated.totals.endingProjectedMinor, baseline.totals.endingProjectedMinor, "Plan comparison"),
    unpaidDeltaMinor: subtractSafeMinor(simulated.totals.unpaidBillsMinor, baseline.totals.unpaidBillsMinor, "Plan comparison"),
    shortageCountDelta: simulated.shortages.length - baseline.shortages.length,
    missedEssentialDelta: simulated.missedEssentials.length - baseline.missedEssentials.length,
    surplusDeltaMinor: subtractSafeMinor(simulated.totals.projectedSurplusMinor, baseline.totals.projectedSurplusMinor, "Plan comparison"),
  };
}

function eventAffordability(base, event) {
  const baseline = runPlan(base);
  const simulated = applyScenario(base, {
    extraExpense: {
      id: "sim-event",
      name: event.name || "Planned purchase",
      amountMinor: event.amountMinor,
      dueDate: event.targetDate,
      essential: false,
      priority: 8,
      paidMinor: 0,
      status: "unpaid",
    },
  });
  const end = simulated.totals.endingProjectedMinor;
  const missed = simulated.missedEssentials.length > baseline.missedEssentials.length;
  let verdict = "comfortably_affordable";
  if (end < 0 || missed) verdict = "currently_unaffordable";
  else if (end < base.emergencyReserveMinor || simulated.shortages.length > baseline.shortages.length) {
    verdict = "affordable_with_adjustments";
  }
  return {
    verdict,
    baseline,
    simulated,
    alternatives: [
      "Reduce the estimated cost.",
      "Move the date after a confirmed income.",
      "Save across more than one planning period.",
    ],
  };
}

module.exports = { runPlan, applyScenario, comparePlans, eventAffordability, remaining };
