/**
 * Arithmetic audit of the computed outputs.
 *
 * Seeds one throwaway household with known income, bills, a full payment and a
 * partial payment, then independently recomputes what the API returns:
 * plan totals, every day's running balance, safe-to-spend, runway, health score,
 * agenda window, report figures and the survival budget.
 *
 *   npm run build && npm start      (terminal 1)
 *   npm run verify                  (terminal 2, MongoDB running)
 *
 * Exits non-zero if any expected value differs from the API's actual value.
 */
const BASE = process.env.VERIFY_BASE || "http://localhost:3000";

let pass = 0;
let fail = 0;
const failures = [];

function check(name, cond, expected, actual) {
  if (cond) {
    pass += 1;
    console.log(`PASS  ${name}`);
  } else {
    fail += 1;
    failures.push({ name, expected, actual });
    console.log(`FAIL  ${name} :: expected ${JSON.stringify(expected)} got ${JSON.stringify(actual)}`);
  }
}

function eq(name, actual, expected) {
  check(name, actual === expected, expected, actual);
}

function parseYmd(value) {
  return new Date(`${value}T00:00:00Z`);
}

function addDays(ymd, days) {
  const dt = parseYmd(ymd);
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function daysInclusive(from, to) {
  return Math.round((parseYmd(to) - parseYmd(from)) / 86_400_000) + 1;
}

function monthBounds(ymd) {
  const [year, month] = ymd.split("-").map(Number);
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const mm = String(month).padStart(2, "0");
  return { from: `${year}-${mm}-01`, to: `${year}-${mm}-${String(last).padStart(2, "0")}`, days: last };
}

function todayPkt() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function inRange(ymd, from, to) {
  return !!ymd && ymd >= from && ymd <= to;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function sum(list, fn) {
  return list.reduce((total, item) => total + fn(item), 0);
}

function makeClient() {
  const store = new Map();
  return {
    header() {
      return [...store.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
    },
    absorb(res) {
      const setCookies = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
      for (const raw of setCookies) {
        const pair = raw.split(";")[0];
        const i = pair.indexOf("=");
        if (i > 0) store.set(pair.slice(0, i), pair.slice(i + 1));
      }
    },
    async call(path, { method = "GET", body } = {}) {
      const headers = { cookie: this.header() };
      let payload;
      if (body !== undefined) {
        headers["content-type"] = "application/json";
        payload = JSON.stringify(body);
      }
      const res = await fetch(BASE + path, { method, headers, body: payload, redirect: "manual" });
      this.absorb(res);
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
      return { status: res.status, data, headers: res.headers };
    },
    async login(email, password) {
      const csrf = await this.call("/api/auth/csrf");
      const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", cookie: this.header() },
        body: new URLSearchParams({
          csrfToken: csrf.data.csrfToken,
          email,
          password,
          callbackUrl: `${BASE}/dashboard`,
          json: "true",
        }).toString(),
        redirect: "manual",
      });
      this.absorb(res);
      return res.status;
    },
    async signup(name, email, password) {
      const res = await fetch(`${BASE}/api/auth/csrf`);
      this.absorb(res);
      return this.call("/api/auth/signup", { method: "POST", body: { name, email, password } });
    },
  };
}

/* ---------- independent reconstruction of the engine's day chain ---------- */

function buildSeedEvents(incomes, expenses, from, to) {
  const events = [];
  for (const inc of incomes) {
    if (inc.receivedMinor > 0 && inRange(inc.receivedDate, from, to)) {
      events.push({ date: inc.receivedDate, type: "income", confirmed: true, amountMinor: inc.receivedMinor, label: inc.name });
    }
    const left = Math.max(0, inc.amountMinor - inc.receivedMinor);
    if (left > 0 && inRange(inc.expectedDate, from, to)) {
      events.push({ date: inc.expectedDate, type: "income", confirmed: false, amountMinor: left, label: inc.name });
    }
  }
  for (const exp of expenses) {
    if (exp.paidMinor > 0 && inRange(exp.paidDate, from, to)) {
      events.push({ date: exp.paidDate, type: "expense", confirmed: true, amountMinor: exp.paidMinor, label: exp.name, essential: !!exp.essential });
    }
    const left = Math.max(0, exp.amountMinor - exp.paidMinor);
    if (left > 0 && inRange(exp.dueDate, from, to)) {
      events.push({ date: exp.dueDate, type: "expense", confirmed: false, amountMinor: left, label: exp.name, essential: !!exp.essential });
    }
  }
  events.sort((a, b) => a.date.localeCompare(b.date) || a.type.localeCompare(b.type) || a.label.localeCompare(b.label));
  return events;
}

function rebuildDaily(events, from, to, startingBalanceMinor) {
  const rows = [];
  let projected = startingBalanceMinor;
  let confirmed = startingBalanceMinor;
  let cursor = 0;
  for (let day = from; day <= to; day = addDays(day, 1)) {
    const startProjected = projected;
    const startConfirmed = confirmed;
    const dayEvents = [];
    while (cursor < events.length && events[cursor].date === day) {
      const ev = events[cursor++];
      if (ev.type === "income") {
        projected += ev.amountMinor;
        if (ev.confirmed) confirmed += ev.amountMinor;
      } else {
        projected -= ev.amountMinor;
        if (ev.confirmed) confirmed -= ev.amountMinor;
      }
      dayEvents.push(ev);
    }
    rows.push({ date: day, startProjected, startConfirmed, endProjected: projected, endConfirmed: confirmed, events: dayEvents });
  }
  return rows;
}

function expectedSafePool(row, confirmedBalance, reserveMinor, endDate, today) {
  const day = row.date;
  const incomeDates = [];
  // Only received money can be "next confirmed income"; expected-only rows never count.
  for (const inc of today.incomes) {
    if (inc.receivedMinor > 0 && inc.receivedDate && inc.receivedDate > day) incomeDates.push(inc.receivedDate);
  }
  const horizon = incomeDates.sort()[0] || endDate;
  let essentialsAhead = 0;
  for (const exp of today.expenses) {
    if (!exp.essential) continue;
    const left = Math.max(0, exp.amountMinor - exp.paidMinor);
    if (left > 0 && exp.dueDate >= day && exp.dueDate <= horizon) essentialsAhead += left;
  }
  const safePool = confirmedBalance - reserveMinor - essentialsAhead;
  const spanDays = Math.max(1, daysInclusive(day, horizon));
  return {
    horizon,
    safePool,
    suggested: safePool <= 0 ? 0 : Math.floor(safePool / spanDays),
    essentialsAhead,
  };
}

function expectedHealth(plan, reserveMinor) {
  const totals = plan.totals;
  const factors = [];
  let score = 100;
  const unpaid = totals.unpaidBillsMinor;
  const coverage = reserveMinor / (unpaid > 0 ? unpaid : 1);
  if (coverage < 1) score -= Math.round(clamp((1 - coverage) * 20, 0, 20));
  if (plan.shortages.length) score -= clamp(plan.shortages.length * 8, 0, 32);
  if (plan.missedEssentials.length) score -= clamp(plan.missedEssentials.length * 10, 0, 30);
  const incomeTotal = totals.confirmedIncomeMinor + totals.expectedIncomeLeftMinor;
  if (incomeTotal > 0) {
    const dependence = totals.expectedIncomeLeftMinor / incomeTotal;
    if (dependence > 0.4) {
      score -= Math.round(clamp((dependence - 0.4) * 30, 0, 18));
      factors.push(`${Math.round(dependence * 100)}% of income is still expected, not received`);
    }
  }
  if (totals.confirmedIncomeMinor > 0) {
    const savingsRate = (totals.confirmedIncomeMinor - totals.actualSpendMinor) / totals.confirmedIncomeMinor;
    if (savingsRate < 0.1) {
      score -= Math.round(clamp((0.1 - savingsRate) * 60, 0, 15));
      factors.push(savingsRate < 0 ? "Spending is above received income" : `Saving only ${Math.round(Math.max(0, savingsRate) * 100)}% of received income`);
    }
  } else if (totals.actualSpendMinor > 0) {
    score -= 10;
  }
  return { score: Math.round(clamp(score, 0, 100)), factors };
}

function bandFor(score) {
  if (score >= 80) return "strong";
  if (score >= 60) return "okay";
  if (score >= 40) return "tight";
  return "at_risk";
}

(async () => {
  // 1. Wait for the server.
  let ready = false;
  for (let i = 0; i < 40 && !ready; i += 1) {
    try {
      const res = await fetch(`${BASE}/api/health`);
      ready = res.ok;
    } catch {
      ready = false;
    }
    if (!ready) await new Promise((r) => setTimeout(r, 500));
  }
  if (!ready) {
    console.error(`No server at ${BASE}. Start it with "npm start" first.`);
    process.exit(1);
  }

  const today = todayPkt();
  const { from: monthStart, to: monthEnd, days: dim } = monthBounds(today);
  const d2 = `${monthStart.slice(0, 8)}02`;
  const d3 = `${monthStart.slice(0, 8)}03`;
  const d4 = `${monthStart.slice(0, 8)}04`;
  const d5 = `${monthStart.slice(0, 8)}05`;
  const futureIncomeDate = addDays(today, 5);
  const futureBillDate = addDays(today, 7);
  const reserveMinor = 2_000_000; // PKR 20,000.00
  const startMinor = 10_000_000; // PKR 100,000.00
  const savingsMinor = 2_500_000; // PKR 25,000.00

  // 2. Fresh user and known household.
  const A = makeClient();
  const stamp = Date.now();
  const email = `calc-${stamp}@example.com`;
  const password = "CalcPass123!";
  const signup = await A.signup("Calc Audit", email, password);
  if (signup.status !== 201) {
    console.error("Could not create the audit account:", signup.status, signup.data);
    process.exit(1);
  }
  eq("audit login", await A.login(email, password), 200);
  const hh = await A.call("/api/household", {
    method: "PATCH",
    body: {
      startingBalance: 100_000,
      savingsBalance: 25_000,
      emergencyReserve: 20_000,
      planningStartDay: 1,
      setupComplete: true,
      members: [
        { label: "Adult A", ageGroup: "adult" },
        { label: "Adult B", ageGroup: "adult" },
      ],
    },
  });
  eq("household starting balance stored in minor units", hh.data?.household?.startingBalanceMinor, startMinor);
  eq("household reserve stored in minor units", hh.data?.household?.emergencyReserveMinor, reserveMinor);

  // 3. Known data set.
  const incomeSeeds = [
    { name: "Salary (partial)", amount: 50_000, expectedDate: d2, category: "salary", receive: 20_000, receivedDate: d2 },
    { name: "Freelance", amount: 30_000, expectedDate: d4, category: "freelance" },
    { name: "Bonus (later)", amount: 10_000, expectedDate: futureIncomeDate, category: "other" },
  ];
  const expenseSeeds = [
    { name: "Rent", amount: 40_000, dueDate: d3, category: "housing", essential: true, pay: 40_000, paidDate: d3 },
    { name: "Groceries", amount: 15_000, dueDate: d5, category: "food", essential: true, pay: 5_000, paidDate: d5 },
    { name: "Transport", amount: 5_000, dueDate: d5, category: "transport", essential: false },
    { name: "Car service (later)", amount: 2_000, dueDate: futureBillDate, category: "transport", essential: false },
  ];

  const created = { incomes: [], expenses: [] };
  for (const seed of incomeSeeds) {
    const res = await A.call("/api/income", {
      method: "POST",
      body: {
        name: seed.name,
        amount: seed.amount,
        expectedDate: seed.expectedDate,
        category: seed.category,
        frequency: "once",
        estimated: true,
      },
    });
    if (res.status !== 201) {
      console.error("income seed failed:", seed.name, res.status, res.data);
      process.exit(1);
    }
    const item = res.data.item;
    if (seed.receive) {
      const patched = await A.call(`/api/income/${item._id}`, {
        method: "PATCH",
        body: { receive: seed.receive, receivedDate: seed.receivedDate },
      });
      eq(`income payment recorded (${seed.name})`, patched.data?.item?.receivedMinor, seed.receive * 100);
      eq(`income status after partial payment (${seed.name})`, patched.data?.item?.status, "partial");
    }
    created.incomes.push(item._id);
  }
  for (const seed of expenseSeeds) {
    const res = await A.call("/api/expenses", {
      method: "POST",
      body: {
        name: seed.name,
        amount: seed.amount,
        dueDate: seed.dueDate,
        category: seed.category,
        essential: seed.essential !== false,
        frequency: "once",
      },
    });
    if (res.status !== 201) {
      console.error("expense seed failed:", seed.name, res.status, res.data);
      process.exit(1);
    }
    const item = res.data.item;
    if (seed.pay) {
      const patched = await A.call(`/api/expenses/${item._id}`, {
        method: "PATCH",
        body: { pay: seed.pay, paidDate: seed.paidDate },
      });
      eq(`bill payment recorded (${seed.name})`, patched.data?.item?.paidMinor, seed.pay * 100);
      eq(`bill status after payment (${seed.name})`, patched.data?.item?.status, seed.pay === seed.amount ? "paid" : "partial");
    }
    created.expenses.push(item._id);
  }

  // Model the same rows the planner loads (only rows whose dates fall in the period).
  const incomes = incomeSeeds
    .filter((s) => inRange(s.expectedDate, monthStart, monthEnd) || inRange(s.receivedDate, monthStart, monthEnd))
    .map((s) => ({
      name: s.name,
      amountMinor: s.amount * 100,
      receivedMinor: (s.receive || 0) * 100,
      expectedDate: s.expectedDate,
      receivedDate: s.receivedDate || null,
    }));
  const expenses = expenseSeeds
    .filter((s) => inRange(s.dueDate, monthStart, monthEnd) || inRange(s.paidDate, monthStart, monthEnd))
    .map((s) => ({
      name: s.name,
      amountMinor: s.amount * 100,
      paidMinor: (s.pay || 0) * 100,
      dueDate: s.dueDate,
      paidDate: s.paidDate || null,
      essential: s.essential !== false,
    }));

  const expectedConfirmed = sum(incomes, (i) => i.receivedMinor);
  const expectedLeft = sum(incomes, (i) => Math.max(0, i.amountMinor - i.receivedMinor));
  const expectedSpend = sum(expenses, (e) => e.paidMinor);
  const expectedUnpaid = sum(expenses, (e) => Math.max(0, e.amountMinor - e.paidMinor));
  const expectedEnding = startMinor + expectedConfirmed + expectedLeft - expectedSpend - expectedUnpaid;

  // 4. Plan API, explicitly bounded to the current cycle.
  const planRes = await A.call(`/api/plan?from=${monthStart}&to=${monthEnd}`);
  eq("plan API returns 200", planRes.status, 200);
  const plan = planRes.data?.plan;
  if (!plan) {
    console.error("No plan returned:", planRes.data);
    process.exit(1);
  }
  eq("plan period echoed", `${planRes.data.period.from}..${planRes.data.period.to}`, `${monthStart}..${monthEnd}`);
  eq("plan day count", plan.daily.length, dim);
  eq("starting balance in plan", plan.startingBalanceMinor, startMinor);
  eq("confirmed income total", plan.totals.confirmedIncomeMinor, expectedConfirmed);
  eq("expected income left total", plan.totals.expectedIncomeLeftMinor, expectedLeft);
  eq("actual spend total", plan.totals.actualSpendMinor, expectedSpend);
  eq("unpaid bills total", plan.totals.unpaidBillsMinor, expectedUnpaid);
  eq("ending projected balance", plan.totals.endingProjectedMinor, expectedEnding);
  eq(
    "totals identity start + income - spend - unpaid",
    plan.totals.endingProjectedMinor,
    startMinor + plan.totals.confirmedIncomeMinor + plan.totals.expectedIncomeLeftMinor - plan.totals.actualSpendMinor - plan.totals.unpaidBillsMinor
  );
  eq(
    "projected surplus = ending - reserve",
    plan.totals.projectedSurplusMinor,
    plan.totals.endingProjectedMinor - reserveMinor
  );
  eq(
    "ending confirmed = start + confirmed income - paid bills",
    plan.totals.endingConfirmedMinor,
    startMinor + expectedConfirmed - expectedSpend
  );

  const events = buildSeedEvents(incomes, expenses, monthStart, monthEnd);
  const rebuilt = rebuildDaily(events, monthStart, monthEnd, startMinor);
  for (const row of plan.daily) {
    const mine = rebuilt.find((r) => r.date === row.date);
    eq(`day ${row.date} starting projected`, row.startingProjectedMinor, mine.startProjected);
    eq(`day ${row.date} starting confirmed`, row.startingConfirmedMinor, mine.startConfirmed);
    eq(`day ${row.date} ending projected`, row.endingProjectedMinor, mine.endProjected);
    eq(`day ${row.date} ending confirmed`, row.endingConfirmedMinor, mine.endConfirmed);
  }
  eq("last day ending equals totals", plan.daily[plan.daily.length - 1].endingProjectedMinor, plan.totals.endingProjectedMinor);

  // Every visible event amount must reconcile with the recorded rows.
  eq(
    "sum of income events = received + still expected",
    sum(plan.daily.flatMap((d) => d.events.filter((e) => e.type === "income")), (e) => e.amountMinor),
    expectedConfirmed + expectedLeft
  );
  eq(
    "sum of expense events = paid + unpaid",
    sum(plan.daily.flatMap((d) => d.events.filter((e) => e.type === "expense")), (e) => e.amountMinor),
    expectedSpend + expectedUnpaid
  );

  const day2 = plan.daily.find((d) => d.date === d2);
  check(
    "partial income splits into received + expected on its date",
    day2?.events.filter((e) => e.type === "income").length === 2 &&
      sum(day2.events.filter((e) => e.type === "income" && e.confirmed), (e) => e.amountMinor) === 2_000_000 &&
      sum(day2.events.filter((e) => e.type === "income" && !e.confirmed), (e) => e.amountMinor) === 3_000_000,
    { received: 2_000_000, expected: 3_000_000 },
    day2?.events
  );
  const day5 = plan.daily.find((d) => d.date === d5);
  check(
    "partial bill splits into paid + unpaid on its due date",
    sum(day5?.events.filter((e) => e.type === "expense" && e.confirmed), (e) => e.amountMinor) === 500_000 &&
      sum(day5?.events.filter((e) => e.type === "expense" && !e.confirmed), (e) => e.amountMinor) === 1_500_000,
    { paid: 500_000, unpaid: 1_500_000 },
    day5?.events
  );
  eq("no shortage with the seeded surplus", plan.shortages.length, 0);
  eq("no missed essential bills", plan.missedEssentials.length, 0);

  // 5. Safe-to-spend for every day.
  for (const row of plan.daily) {
    const expected = expectedSafePool(row, row.endingConfirmedMinor, reserveMinor, monthEnd, { incomes, expenses });
    eq(`day ${row.date} safe pool`, row.safePoolMinor, expected.safePool);
    eq(`day ${row.date} suggested discretionary`, row.suggestedDiscretionaryMinor, expected.suggested);
    eq(`day ${row.date} next confirmed income`, row.nextConfirmedIncomeDate, expected.horizon === monthEnd ? null : expected.horizon);
  }

  // 6. Reports must agree with the plan.
  const reportRes = await A.call(`/api/reports?from=${monthStart}&to=${monthEnd}`);
  eq("reports API returns 200", reportRes.status, 200);
  const report = reportRes.data;
  eq("report starting balance", report.startingBalanceMinor, startMinor);
  eq("report confirmed income", report.confirmedIncomeMinor, expectedConfirmed);
  eq("report expected income", report.expectedIncomeMinor, expectedLeft);
  eq("report actual spend", report.actualSpendMinor, expectedSpend);
  eq("report unpaid bills", report.unpaidBillsMinor, expectedUnpaid);
  eq("report ending projected", report.endingProjectedMinor, expectedEnding);
  eq("report ending confirmed", report.endingConfirmedMinor, plan.totals.endingConfirmedMinor);
  eq("report projected surplus", report.projectedSurplusMinor, expectedEnding - reserveMinor);
  eq("report savings balance", report.actualSavingsMinor, savingsMinor);
  eq("report has no over-budget categories", report.overCategories.length, 0);
  const reportPlanned = sum(Object.values(report.byCategory || {}), (v) => v.planned);
  const reportActual = sum(Object.values(report.byCategory || {}), (v) => v.actual);
  eq("report category planned sum", reportPlanned, sum(expenses, (e) => e.amountMinor));
  eq("report category actual sum", reportActual, expectedSpend);

  // 7. Health score, runway and agenda from the insights endpoint.
  const insightsRes = await A.call("/api/insights");
  eq("insights API returns 200", insightsRes.status, 200);
  const insights = insightsRes.data;
  eq("insights period matches the plan period", `${insights.period.from}..${insights.period.to}`, `${monthStart}..${monthEnd}`);
  eq("insights plan totals match plan API", JSON.stringify(insights.plan.totals), JSON.stringify(plan.totals));
  eq("insights today", insights.today, today);

  const healthExpected = expectedHealth(plan, reserveMinor);
  eq("health score recomputed from totals", insights.health.score, healthExpected.score);
  eq("health band matches score", insights.health.band, bandFor(healthExpected.score));
  for (const label of healthExpected.factors) {
    check(`health factor present: ${label}`, insights.health.factors.some((f) => f.label === label), label, insights.health.factors.map((f) => f.label));
  }
  eq("health reserve factor", insights.health.factors[0].label, "Emergency reserve covers unpaid essentials");
  eq("health reserve impact", insights.health.factors[0].impact, 0);

  const runwayExpected = (() => {
    let count = 0;
    for (const row of rebuilt) {
      if (row.date < today) continue;
      if (row.endProjected < 0) break;
      count += 1;
    }
    return count;
  })();
  eq("runway counts non-negative days from today", insights.runway, runwayExpected);
  eq("today row balance", insights.todayRow.endingProjectedMinor, rebuilt.find((r) => r.date === today)?.endProjected ?? null);

  // The agenda is a rolling 14-day window over every stored row, including dates
  // that sit outside the current planning cycle (here: early next month).
  const allIncomes = incomeSeeds.map((s) => ({
    name: s.name,
    amountMinor: s.amount * 100,
    receivedMinor: (s.receive || 0) * 100,
    expectedDate: s.expectedDate,
    receivedDate: s.receivedDate || null,
  }));
  const allExpenses = expenseSeeds.map((s) => ({
    name: s.name,
    amountMinor: s.amount * 100,
    paidMinor: (s.pay || 0) * 100,
    dueDate: s.dueDate,
    paidDate: s.paidDate || null,
    essential: s.essential !== false,
  }));
  const agendaExpected = buildSeedEvents(allIncomes, allExpenses, today, addDays(today, 14)).map((e) => ({
    date: e.date,
    type: e.type,
    label: e.label,
    amountMinor: e.amountMinor,
    confirmed: !!e.confirmed,
  }));
  eq("agenda row count", insights.agenda.length, agendaExpected.length);
  for (let i = 0; i < agendaExpected.length; i += 1) {
    eq(`agenda[${i}] date`, insights.agenda[i]?.date, agendaExpected[i].date);
    eq(`agenda[${i}] type`, insights.agenda[i]?.type, agendaExpected[i].type);
    eq(`agenda[${i}] label`, insights.agenda[i]?.label, agendaExpected[i].label);
    eq(`agenda[${i}] amount`, insights.agenda[i]?.amountMinor, agendaExpected[i].amountMinor);
    eq(`agenda[${i}] confirmed flag`, insights.agenda[i]?.confirmed, agendaExpected[i].confirmed);
  }
  eq("agenda is chronological", JSON.stringify(insights.agenda.map((a) => a.date)), JSON.stringify([...insights.agenda.map((a) => a.date)].sort()));

  const categoryPlanned = sum(Object.values(insights.categories || {}), (v) => v.planned);
  const categoryPaid = sum(Object.values(insights.categories || {}), (v) => v.paid);
  eq("insights category planned sum", categoryPlanned, sum(expenses, (e) => e.amountMinor));
  eq("insights category paid sum", categoryPaid, expectedSpend);

  const currentCycle = insights.trend[insights.trend.length - 1];
  eq("trend current cycle income", currentCycle.incomeMinor, plan.totals.confirmedIncomeMinor);
  eq("trend current cycle expected income", currentCycle.expectedIncomeMinor, plan.totals.expectedIncomeLeftMinor);
  eq("trend current cycle spend", currentCycle.spendMinor, plan.totals.actualSpendMinor);
  eq("trend current cycle unpaid", currentCycle.unpaidMinor, plan.totals.unpaidBillsMinor);
  eq("trend current cycle ending", currentCycle.endingProjectedMinor, plan.totals.endingProjectedMinor);
  eq("trend current cycle shortages", currentCycle.shortages, plan.shortages.length);

  // 8. Survival budget uses the same confirmed/expected income.
  const survivalPut = await A.call("/api/survival", {
    method: "PUT",
    body: { housing: 30_000, food: 20_000, utilities: 5_000, transport: 3_000, medical: 1_000, education: 0, other: 1_000, useLocationEstimates: false },
  });
  eq("survival settings saved", survivalPut.status, 200);
  const survival = survivalPut.data?.result;
  const essentialsMinor = 60_000 * 100;
  eq("survival monthly essentials", survival.monthlyEssentialMinor, essentialsMinor);
  eq("survival daily essentials", survival.dailyMinor, Math.round(essentialsMinor / dim));
  eq("survival weekly essentials", survival.weeklyMinor, Math.round((essentialsMinor * 7) / dim));
  eq("survival confirmed income", plan.totals.confirmedIncomeMinor, expectedConfirmed);
  eq("survival remaining after confirmed", survival.remainingAfterConfirmedMinor, expectedConfirmed - essentialsMinor);
  eq("survival remaining after projected", survival.remainingAfterProjectedMinor, expectedConfirmed + expectedLeft - essentialsMinor);
  eq("survival status", survival.status, "tight");
  eq("survival headline", survival.headline, "Budget is tight");
  eq("survival breakdown sum", sum(Object.values(survival.breakdown), (v) => v), essentialsMinor);

  const survivalGet = await A.call("/api/survival");
  eq("survival GET matches PUT", JSON.stringify(survivalGet.data?.result), JSON.stringify(survival));

  // 9. Clean up the seeded rows (the throwaway household is left in place).
  for (const id of created.incomes) await A.call(`/api/income/${id}`, { method: "DELETE" });
  for (const id of created.expenses) await A.call(`/api/expenses/${id}`, { method: "DELETE" });

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) {
    console.log(JSON.stringify(failures, null, 2));
    process.exit(1);
  }
  console.log("All calculated outputs match the independent recomputation.");
  process.exit(0);
})().catch((err) => {
  console.error("verify-calc crashed:", err);
  process.exit(1);
});
