/**
 * End-to-end smoke test against a running server and a real MongoDB.
 *
 *   npm run build && npm start        (terminal 1)
 *   npm run e2e                       (terminal 2)
 *
 * Creates throwaway users with timestamped emails. Safe for a local/dev database.
 */
const BASE = process.env.E2E_BASE || "http://localhost:3000";

let pass = 0;
let fail = 0;
const failures = [];

function check(name, cond, detail) {
  if (cond) {
    pass += 1;
    console.log(`PASS  ${name}`);
  } else {
    fail += 1;
    failures.push({ name, detail });
    console.log(`FAIL  ${name} :: ${JSON.stringify(detail)}`);
  }
}

function pktToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function addDays(ymd, days) {
  const dt = new Date(`${ymd}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function monthBounds(ymd) {
  const [year, month] = ymd.split("-").map(Number);
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const mm = String(month).padStart(2, "0");
  return { from: `${year}-${mm}-01`, to: `${year}-${mm}-${String(last).padStart(2, "0")}`, days: last };
}

function makeClient() {
  const store = new Map();
  return {
    jar: store,
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
    async call(path, { method = "GET", body, raw = false } = {}) {
      const headers = { cookie: this.header() };
      let payload;
      if (body !== undefined) {
        headers["content-type"] = "application/json";
        payload = JSON.stringify(body);
      }
      const res = await fetch(BASE + path, { method, headers, body: payload, redirect: "manual" });
      this.absorb(res);
      if (raw) return res;
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

(async () => {
  const A = makeClient();
  const B = makeClient();
  const C = makeClient();
  const stamp = Date.now();
  const password = "TestPass123!";
  const aEmail = `e2e-a-${stamp}@example.com`;
  const bEmail = `e2e-b-${stamp}@example.com`;
  const cEmail = `e2e-c-${stamp}@example.com`;

  const today = pktToday();
  const { from: monthStart, to: monthEnd, days: daysInMonth } = monthBounds(today);
  const incomeDate = `${monthStart.slice(0, 8)}02`;
  const billDate = `${monthStart.slice(0, 8)}03`;
  const futureDate = dayNumber(today) <= daysInMonth - 3 ? addDays(today, 3) : monthEnd;
  const nextMonth = monthBounds(monthEnd);
  function dayNumber(ymd) {
    return Number(ymd.slice(8));
  }

  // Wait for the production server to accept requests.
  let ready = false;
  for (let attempt = 0; attempt < 45 && !ready; attempt += 1) {
    try {
      const res = await fetch(`${BASE}/api/health`);
      ready = res.ok;
    } catch {
      ready = false;
    }
    if (!ready) await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  check("server is reachable", ready, BASE);
  if (!ready) process.exit(2);

  // ---------- signup / login ----------
  const signupA = await A.signup("Ayesha Khan", aEmail, password);
  check("signup A returns 201", signupA.status === 201, signupA.data);
  check("login A succeeds", (await A.login(aEmail, password)) === 200, "login status");
  const sessionA = await A.call("/api/auth/session");
  check("session A has a user id", !!sessionA.data?.user?.id, sessionA.data);

  const wrong = makeClient();
  const wrongCsrf = await wrong.call("/api/auth/csrf");
  const wrongRes = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie: wrong.header() },
    body: new URLSearchParams({
      csrfToken: wrongCsrf.data.csrfToken,
      email: aEmail,
      password: "WrongPassword123!",
      callbackUrl: `${BASE}/dashboard`,
      json: "true",
    }).toString(),
    redirect: "manual",
  });
  check("wrong password rejected", wrongRes.status === 401, wrongRes.status);

  // ---------- household ----------
  const household0 = await A.call("/api/household");
  check("household bootstrapped at signup", household0.status === 200 && !!household0.data?.household?._id, household0.status);
  check("A is owner", household0.data?.role === "owner", household0.data?.role);

  const onboard = await A.call("/api/household", {
    method: "PATCH",
    body: {
      name: "Khan Household",
      country: "PK",
      currency: "PKR",
      city: "Karachi",
      timezone: "Asia/Karachi",
      members: [
        { label: "Ayesha", ageGroup: "adult" },
        { label: "Bilal", ageGroup: "adult" },
        { label: "Sara", ageGroup: "child" },
      ],
      startingBalance: 25000,
      savingsBalance: 10000,
      emergencyReserve: 5000,
      planningStartDay: 1,
      setupComplete: true,
    },
  });
  check("onboarding saves", onboard.status === 200, onboard.data);
  check("onboarding persists members", onboard.data?.household?.members?.length === 3, onboard.data?.household?.members);
  check("money stored in minor units", onboard.data?.household?.startingBalanceMinor === 2500000, onboard.data?.household?.startingBalanceMinor);

  const clamp = await A.call("/api/household", { method: "PATCH", body: { planningStartDay: 99 } });
  check("planningStartDay clamped to 28", clamp.data?.household?.planningStartDay === 28, clamp.data?.household?.planningStartDay);
  await A.call("/api/household", { method: "PATCH", body: { planningStartDay: 1 } });

  // ---------- repeating income: one visible occurrence, not a template ----------
  const salary = await A.call("/api/income", {
    method: "POST",
    body: { name: "Salary", amount: 150000, expectedDate: incomeDate, category: "salary", frequency: "monthly", estimated: true },
  });
  check("create monthly salary", salary.status === 201 && !!salary.data?.item?._id, salary.data);

  const salaryList = await A.call("/api/income?limit=50");
  const salaryRows = (salaryList.data?.items || []).filter((i) => i.name === "Salary");
  check("repeating income shows exactly one row", salaryRows.length === 1, salaryRows.length);
  check("income row is linked to its schedule", !!salaryRows[0]?.scheduleId, salaryRows[0]?.scheduleId);
  const salaryOccurrenceId = salaryRows[0]?._id;
  check("income list excludes the hidden template", salaryRows.every((i) => i.occurrenceKey), "template leaked");

  const receive = await A.call(`/api/income/${salaryOccurrenceId}`, {
    method: "PATCH",
    body: { receive: 50000, receivedDate: incomeDate, note: "advance" },
  });
  check(
    "partial income payment lands on the payable row",
    receive.status === 200 && receive.data?.item?.receivedMinor === 5000000 && receive.data?.item?.status === "partial",
    receive.data?.item
  );

  const freelance = await A.call("/api/income", {
    method: "POST",
    body: { name: "Freelance", amount: 30000, expectedDate: futureDate, category: "freelance", frequency: "once" },
  });
  check("create one-time income", freelance.status === 201, freelance.data);

  const dup = await A.call("/api/income", {
    method: "POST",
    body: { name: "Freelance", amount: 30000, expectedDate: futureDate, category: "freelance", frequency: "once" },
  });
  check("duplicate one-time income rejected 409", dup.status === 409, dup.data);

  const badIncome = await A.call("/api/income", { method: "POST", body: { name: "Bad", amount: -5, expectedDate: incomeDate } });
  check("negative income rejected", badIncome.status === 400, badIncome.data);

  const badDate = await A.call("/api/income", { method: "POST", body: { name: "Bad date", amount: 100, expectedDate: "2026-02-30" } });
  check("impossible date rejected", badDate.status === 400, badDate.data);

  const zeroIncome = await A.call("/api/income", { method: "POST", body: { name: "Zero", amount: 0, expectedDate: incomeDate } });
  check("zero income rejected", zeroIncome.status === 400, zeroIncome.data);

  // ---------- repeating expense ----------
  const rent = await A.call("/api/expenses", {
    method: "POST",
    body: {
      name: "Rent",
      amount: 50000,
      dueDate: billDate,
      category: "rent_housing",
      frequency: "monthly",
      essential: true,
      priority: 1,
    },
  });
  check("create monthly rent", rent.status === 201, rent.data);

  const expenseList = await A.call("/api/expenses?limit=50");
  const rentRows = (expenseList.data?.items || []).filter((e) => e.name === "Rent");
  check("repeating expense shows exactly one row", rentRows.length === 1, rentRows.length);
  const rentOccurrenceId = rentRows[0]?._id;

  const paid = await A.call(`/api/expenses/${rentOccurrenceId}`, {
    method: "PATCH",
    body: { pay: 50000, paidDate: billDate, note: "rent" },
  });
  check(
    "bill payment lands on the payable row",
    paid.status === 200 && paid.data?.item?.paidMinor === 5000000 && paid.data?.item?.status === "paid",
    paid.data?.item
  );

  const badExpense = await A.call("/api/expenses", { method: "POST", body: { name: "Zero", amount: 0, dueDate: billDate } });
  check("zero amount expense rejected", badExpense.status === 400, badExpense.data);

  // Edit a repeating row: it must propagate to the schedule for next month.
  const editRent = await A.call(`/api/expenses/${rentOccurrenceId}`, { method: "PATCH", body: { category: "debt", priority: 2 } });
  check("repeating expense edit accepted", editRent.status === 200 && editRent.data?.item?.category === "debt", editRent.data?.item?.category);

  const nextPlan = await A.call(`/api/plan?from=${nextMonth.from}&to=${nextMonth.to}`);
  check("next cycle plan loads", nextPlan.status === 200 && !!nextPlan.data?.plan, nextPlan.status);
  const nextDebt = await A.call(`/api/reports?from=${nextMonth.from}&to=${nextMonth.to}&category=debt`);
  check("schedule edit reaches future cycles", nextDebt.data?.byCategory?.debt?.planned === 5000000, nextDebt.data?.byCategory);
  await A.call(`/api/expenses/${rentOccurrenceId}`, { method: "PATCH", body: { category: "rent_housing" } });

  // ---------- plan ----------
  const plan = await A.call("/api/plan");
  check("plan returns totals", plan.status === 200 && !!plan.data?.plan?.totals, plan.data?.plan?.totals);
  check("plan period is the current cycle", plan.data?.period?.from === monthStart && plan.data?.period?.to === monthEnd, plan.data?.period);
  check("plan counts received income", plan.data?.plan?.totals?.confirmedIncomeMinor === 5000000, plan.data?.plan?.totals?.confirmedIncomeMinor);
  check("plan counts paid bills", plan.data?.plan?.totals?.actualSpendMinor === 5000000, plan.data?.plan?.totals?.actualSpendMinor);
  check("plan has a day-by-day series", Array.isArray(plan.data?.plan?.daily) && plan.data.plan.daily.length === daysInMonth, plan.data?.plan?.daily?.length);

  // ---------- insights ----------
  const insights = await A.call("/api/insights");
  check("insights endpoint returns health", insights.status === 200 && typeof insights.data?.health?.score === "number", insights.data?.health);
  check("health score has a band", ["strong", "okay", "tight", "at_risk"].includes(insights.data?.health?.band), insights.data?.health?.band);
  check("insights agenda is a list", Array.isArray(insights.data?.agenda), insights.data?.agenda);
  check("insights has a six-cycle trend", insights.data?.trend?.length === 6, insights.data?.trend?.length);
  check("insights exposes runway days", Number.isFinite(insights.data?.runway), insights.data?.runway);
  check("insights totals categories", insights.data?.categories?.rent_housing?.planned === 5000000, insights.data?.categories?.rent_housing);

  // ---------- reports ----------
  const report = await A.call("/api/reports");
  check("report 200", report.status === 200, report.status);
  check("report planned rent", report.data?.byCategory?.rent_housing?.planned === 5000000, report.data?.byCategory?.rent_housing);
  check("report actual rent", report.data?.byCategory?.rent_housing?.actual === 5000000, report.data?.byCategory?.rent_housing);
  const filtered = await A.call("/api/reports?category=groceries");
  check("report category filter", Object.keys(filtered.data?.byCategory || {}).length === 0, filtered.data?.byCategory);

  // ---------- goals / events ----------
  const goal = await A.call("/api/goals", {
    method: "POST",
    body: { name: "Bike", target: 200000, saved: 20000, targetDate: "2027-03-01", contribution: 10000 },
  });
  check("goal created", goal.status === 201 && !!goal.data?.item?._id, goal.data);
  const goalId = goal.data?.item?._id;
  const goalEdit = await A.call(`/api/goals/${goalId}`, { method: "PATCH", body: { target: 180000 } });
  check("goal edited", goalEdit.status === 200 && goalEdit.data?.item?.targetMinor === 18000000, goalEdit.data?.item?.targetMinor);
  const badGoal = await A.call("/api/goals", { method: "POST", body: { name: "Bad", target: 0, targetDate: "bad" } });
  check("invalid goal rejected 400", badGoal.status === 400, badGoal.status);

  const event = await A.call("/api/events", {
    method: "POST",
    body: { name: "Wedding", kind: "wedding", amount: 300000, targetDate: addDays(today, 40) },
  });
  check("event created", event.status === 201 && !!event.data?.item?._id, event.data);
  const eventId = event.data?.item?._id;
  const events = await A.call("/api/events");
  const ev = (events.data?.items || []).find((x) => x._id === eventId);
  check("event verdict computed", !!ev?.verdict, ev?.verdict);
  const badKind = await A.call("/api/events", { method: "POST", body: { name: "Party", kind: "festival", amount: 100, targetDate: today } });
  check("invalid event kind rejected 400", badKind.status === 400, badKind.data);
  const eventEdit = await A.call(`/api/events/${eventId}`, { method: "PATCH", body: { kind: "purchase", name: "Wedding gift" } });
  check("event kind edited", eventEdit.status === 200 && eventEdit.data?.item?.kind === "purchase", eventEdit.data?.item?.kind);

  // ---------- simulator ----------
  const sim = await A.call("/api/simulate", {
    method: "POST",
    body: { name: "Medical shock", extraName: "Medical", extraAmount: 50000, extraDate: futureDate, save: true },
  });
  check("simulator runs", sim.status === 200 && !!sim.data?.baseline && !!sim.data?.simulated, sim.status);
  check("simulated ending balance drops", sim.data?.diff?.endingProjectedDeltaMinor < 0, sim.data?.diff);
  check("scenario saved", !!sim.data?.saved?._id, sim.data?.saved);
  const scenarioId = sim.data?.saved?._id;
  const scenarios = await A.call("/api/simulate");
  check("scenario listed", (scenarios.data?.items || []).some((s) => s._id === scenarioId), scenarios.data?.items?.length);
  const replay = await A.call("/api/simulate", { method: "POST", body: { scenarioId } });
  check("scenario replay works", replay.status === 200 && replay.data?.saved === null, replay.data?.saved);

  // ---------- survival ----------
  const survivalPut = await A.call("/api/survival", {
    method: "PUT",
    body: {
      housing: 50000,
      food: 30000,
      utilities: 15000,
      transport: 8000,
      medical: 5000,
      education: 10000,
      other: 2000,
      useLocationEstimates: false,
    },
  });
  check(
    "survival budget saves",
    survivalPut.status === 200 && survivalPut.data?.result?.monthlyEssentialMinor === 12000000,
    survivalPut.data?.result?.monthlyEssentialMinor
  );

  // ---------- CSV ----------
  const csvRes = await A.call("/api/export/csv?type=income", { raw: true });
  const csvBytes = new Uint8Array(await csvRes.clone().arrayBuffer());
  const csvText = await csvRes.text();
  check("CSV download responds", csvRes.status === 200, csvRes.status);
  check(
    "CSV is a UTF-8 BOM download",
    csvBytes[0] === 0xef && csvBytes[1] === 0xbb && csvBytes[2] === 0xbf,
    [...csvBytes.slice(0, 3)]
  );
  check("CSV has a header row", /Name,Category,Status/.test(csvText), csvText.slice(0, 80));
  check("CSV has no hidden schedule templates", !/Salary,salary,monthly/.test(csvText), "template leaked");
  check("CSV contains the payable income row", /Salary,salary,(expected|partial)/.test(csvText), csvText.slice(0, 200));

  // ---------- JSON export ----------
  const exported = await A.call("/api/household/export");
  const raw = JSON.stringify(exported.data);
  check("export returns household + records", exported.status === 200 && Array.isArray(exported.data?.incomes), exported.status);
  check("export never contains password hash", !raw.includes("passwordHash"), "leak");

  // ---------- delete repeating series ----------
  const gym = await A.call("/api/expenses", {
    method: "POST",
    body: { name: "Gym", amount: 1000, dueDate: addDays(today, 1), frequency: "monthly" },
  });
  const gymList = await A.call("/api/expenses?limit=50");
  const gymRow = (gymList.data?.items || []).find((e) => e.name === "Gym");
  const gymDelete = await A.call(`/api/expenses/${gymRow?._id}`, { method: "DELETE" });
  check("deleting a repeating row deletes the series", gym.status === 201 && gymDelete.status === 200, gymDelete.data);
  const gymList2 = await A.call("/api/expenses?limit=50");
  check("deleted series does not reappear", !(gymList2.data?.items || []).some((e) => e.name === "Gym"), "resurrected");

  // ---------- demo data (fresh user C) ----------
  const signupC = await C.signup("Demo User", cEmail, password);
  check("signup C", signupC.status === 201, signupC.data);
  check("login C", (await C.login(cEmail, password)) === 200, "login C");

  const demo = await C.call("/api/demo", { method: "POST" });
  check("demo seed loads records", demo.status === 200 && demo.data?.counts?.incomes > 0 && demo.data?.counts?.expenses > 0, demo.data);
  const demoAgain = await C.call("/api/demo", { method: "POST" });
  check("demo seed refuses a second load", demoAgain.status === 409, demoAgain.status);

  const cHousehold = await C.call("/api/household");
  check("demo seed labels the household", !!cHousehold.data?.household?.demoSeededAt, cHousehold.data?.household?.demoSeededAt);
  const cInsights = await C.call("/api/insights");
  check("demo data produces a plan", cInsights.data?.plan?.daily?.some((d) => (d.events || []).length > 0), "empty plan");
  check("demo data produces health + trend", typeof cInsights.data?.health?.score === "number" && cInsights.data?.trend?.length === 6, cInsights.data?.health);

  const cCsv = await C.call("/api/export/csv?type=expenses", { raw: true });
  const cCsvText = await cCsv.text();
  check("demo CSV includes example bills", /House rent/.test(cCsvText), cCsvText.slice(0, 120));

  const demoClear = await C.call("/api/demo", { method: "DELETE" });
  check("demo data clears", demoClear.status === 200 && demoClear.data?.removed?.expenses > 0, demoClear.data);
  const cHousehold2 = await C.call("/api/household");
  check(
    "demo clear resets seeded fields",
    cHousehold2.data?.household?.demoSeededAt === null &&
      cHousehold2.data?.household?.startingBalanceMinor === 0 &&
      (cHousehold2.data?.household?.members || []).length === 0,
    cHousehold2.data?.household
  );
  const cPlan2 = await C.call("/api/plan");
  check("demo clear leaves no projected income", cPlan2.data?.plan?.totals?.confirmedIncomeMinor === 0 && cPlan2.data?.plan?.totals?.expectedIncomeLeftMinor === 0, cPlan2.data?.plan?.totals);

  // ---------- isolation (user B) ----------
  check("signup B", (await B.signup("Bilal Ahmed", bEmail, password)).status === 201, "signup B");
  check("login B", (await B.login(bEmail, password)) === 200, "login B");
  const bIncome = await B.call("/api/income");
  check("B sees no A income", bIncome.status === 200 && bIncome.data?.total === 0, bIncome.data?.total);
  const bPatchA = await B.call(`/api/income/${salaryOccurrenceId}`, { method: "PATCH", body: { name: "hacked" } });
  check("B cannot edit A income", bPatchA.status === 404, bPatchA.status);
  const bDeleteA = await B.call(`/api/expenses/${rentOccurrenceId}`, { method: "DELETE" });
  check("B cannot delete A expense", bDeleteA.status === 404, bDeleteA.status);
  const bReplayA = await B.call("/api/simulate", { method: "POST", body: { scenarioId } });
  check("B cannot replay A scenario", bReplayA.status === 404, bReplayA.status);
  const bPlan = await B.call("/api/plan");
  check("B plan is isolated", bPlan.data?.plan?.totals?.confirmedIncomeMinor === 0, bPlan.data?.plan?.totals?.confirmedIncomeMinor);

  // ---------- security headers / private pages ----------
  const home = await fetch(`${BASE}/`);
  const h = home.headers;
  check("header x-frame-options", h.get("x-frame-options") === "DENY", h.get("x-frame-options"));
  check("header x-content-type-options", h.get("x-content-type-options") === "nosniff", h.get("x-content-type-options"));
  check("header referrer-policy", !!h.get("referrer-policy"), h.get("referrer-policy"));
  check("header permissions-policy", !!h.get("permissions-policy"), h.get("permissions-policy"));

  const anonDash = await fetch(`${BASE}/dashboard`, { redirect: "manual" });
  check("dashboard requires login", anonDash.status === 307 || anonDash.status === 302, anonDash.status);
  const anonDemo = await fetch(`${BASE}/api/demo`, { method: "POST" });
  check("demo API requires auth", anonDemo.status === 401, anonDemo.status);
  const anonCsv = await fetch(`${BASE}/api/export/csv?type=income`);
  check("CSV requires auth", anonCsv.status === 401, anonCsv.status);

  const dash = await fetch(`${BASE}/dashboard`, { headers: { cookie: A.header() }, redirect: "manual" });
  check("dashboard renders for authed user", dash.status === 200, dash.status);
  const dashHtml = dash.status === 200 ? await dash.text() : "";
  check("dashboard is noindex", /noindex/i.test(dashHtml), "no noindex");

  // ---------- PWA ----------
  const manifest = await fetch(`${BASE}/manifest.webmanifest`);
  const manifestData = await manifest.json().catch(() => ({}));
  check("manifest served", manifest.status === 200 && manifestData.name?.includes("FamilyFinance"), manifest.status);
  check("manifest is standalone", manifestData.display === "standalone", manifestData.display);
  check("manifest has 192 + 512 + maskable icons", (manifestData.icons || []).length >= 3, manifestData.icons?.length);
  check("manifest theme colour", manifestData.theme_color === "#00A6D6", manifestData.theme_color);

  const sw = await fetch(`${BASE}/sw.js`);
  const swText = await sw.text();
  check("service worker served", sw.status === 200, sw.status);
  check("service worker never caches API responses", /startsWith\("\/api\/"\)/.test(swText), "missing API guard");

  const offline = await fetch(`${BASE}/offline`);
  check("offline fallback page served", offline.status === 200, offline.status);

  for (const icon of ["icon-192.png", "icon-512.png", "icon-maskable-512.png", "apple-touch-icon.png"]) {
    const res = await fetch(`${BASE}/icons/${icon}`);
    check(`icon ${icon} served`, res.status === 200 && (res.headers.get("content-type") || "").includes("image/png"), res.status);
  }

  const rootHtml = await home.text();
  check("root page links the manifest", /rel="manifest"/.test(rootHtml), "no manifest link");
  check("root page sets a theme colour", /name="theme-color"/.test(rootHtml), "no theme-color");

  // ---------- cleanup ----------
  const delScenario = await A.call(`/api/simulate/${scenarioId}`, { method: "DELETE" });
  check("scenario delete", delScenario.status === 200, delScenario.status);

  console.log(`\n==== ${pass} passed, ${fail} failed ====`);
  if (fail) console.log(JSON.stringify(failures, null, 2));
  process.exit(fail ? 1 : 0);
})().catch((err) => {
  console.error("HARNESS ERROR", err);
  process.exit(2);
});
