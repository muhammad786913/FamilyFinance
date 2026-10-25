const { enumerateDays, addDays, weekStart, inRange } = require("../dates");

function remaining(planned, actual) {
  return Math.max(0, (planned || 0) - (actual || 0));
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
    if (left > 0 && exp.dueDate >= fromDate && exp.dueDate <= toDate) total += left;
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
        projected += ev.amountMinor;
        if (ev.confirmed) confirmed += ev.amountMinor;
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
            shortfallMinor: ev.amountMinor - projected,
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
        projected -= ev.amountMinor;
        if (ev.confirmed) confirmed -= ev.amountMinor;
        explanations.push(`${day}: ${ev.confirmed ? "paid" : "due"} "${ev.label}" -${ev.amountMinor}.`);
      }
      dayEvents.push(ev);
      if (projected < emergencyReserveMinor) {
        noteShortage(`${day}:reserve`, {
          date: day,
          kind: "reserve",
          label: "Emergency reserve at risk",
          shortfallMinor: emergencyReserveMinor - projected,
          confirmed: false,
        });
      }
    }

    const horizon = nextConfirmedIncomeDate(incomes, day) || endDate;
    const essentialsAhead = sumEssentialsDue(expenses, day, horizon);
    const safePool = confirmed - emergencyReserveMinor - essentialsAhead;
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
  const confirmedIncome = incomes.reduce((s, i) => s + (i.receivedMinor || 0), 0);
  const expectedIncomeLeft = incomes.reduce((s, i) => s + remaining(i.amountMinor, i.receivedMinor), 0);
  const actualSpend = expenses.reduce((s, e) => s + (e.paidMinor || 0), 0);
  const unpaid = expenses.reduce((s, e) => s + remaining(e.amountMinor, e.paidMinor), 0);
  const monthEndProjected = last ? last.endingProjectedMinor : startingBalanceMinor;
  const surplusProjected = monthEndProjected - emergencyReserveMinor;

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
    if (inc && inc.expectedDate) inc.expectedDate = addDays(inc.expectedDate, scenario.delayDays);
  }
  if (scenario.incomeAmountId != null && scenario.incomeAmountMinor != null) {
    const inc = incomes.find((i) => i.id === scenario.incomeAmountId);
    if (inc) inc.amountMinor = scenario.incomeAmountMinor;
  }
  if (scenario.expenseMultiplier && scenario.expenseCategory) {
    for (const exp of expenses) {
      if (exp.category === scenario.expenseCategory) {
        exp.amountMinor = Math.round(exp.amountMinor * scenario.expenseMultiplier);
      }
    }
  }
  if (scenario.extraExpense) expenses.push({ ...scenario.extraExpense, paidMinor: 0, status: "unpaid" });
  if (scenario.extraIncome) incomes.push({ ...scenario.extraIncome, receivedMinor: 0, status: "expected" });
  return runPlan({ ...base, incomes, expenses });
}

function comparePlans(baseline, simulated) {
  return {
    endingProjectedDeltaMinor: simulated.totals.endingProjectedMinor - baseline.totals.endingProjectedMinor,
    unpaidDeltaMinor: simulated.totals.unpaidBillsMinor - baseline.totals.unpaidBillsMinor,
    shortageCountDelta: simulated.shortages.length - baseline.shortages.length,
    missedEssentialDelta: simulated.missedEssentials.length - baseline.missedEssentials.length,
    surplusDeltaMinor: simulated.totals.projectedSurplusMinor - baseline.totals.projectedSurplusMinor,
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
