"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Alert, Badge, Button, Card, Empty, ProgressBar } from "@/components/ui";
import { DailySavingsCard } from "@/components/DailySavingsCard";
import { api, formatMoney } from "@/lib/format";

const BAND_STYLE = {
  strong: { ring: "#00A6D6", text: "text-cyan" },
  okay: { ring: "#3E7CB1", text: "text-[#3E7CB1]" },
  tight: { ring: "#B0892C", text: "text-[#8A6A1F]" },
  at_risk: { ring: "#8B3A3A", text: "text-[#8B3A3A]" },
};

function shortDate(ymd) {
  return new Date(`${ymd}T00:00:00Z`).toLocaleDateString("en-PK", { day: "numeric", month: "short", timeZone: "UTC" });
}

function dayDiff(from, to) {
  return Math.round((new Date(`${to}T00:00:00Z`) - new Date(`${from}T00:00:00Z`)) / 86_400_000);
}

function monthLabel(ymd) {
  return new Date(`${ymd}T00:00:00Z`).toLocaleDateString("en-PK", { month: "short", timeZone: "UTC" });
}

function HealthRing({ health }) {
  const style = BAND_STYLE[health.band] || BAND_STYLE.okay;
  return (
    <div className="flex items-center gap-4">
      <div
        className="grid h-24 w-24 shrink-0 place-items-center rounded-full"
        style={{ background: `conic-gradient(${style.ring} ${health.score * 3.6}deg, #D9E8F5 0deg)` }}
        role="img"
        aria-label={`Cash-flow health score ${health.score} out of 100, ${health.label}`}
      >
        <div className="grid h-[76px] w-[76px] place-items-center rounded-full bg-white">
          <span className="text-2xl font-semibold">{health.score}</span>
          <span className="text-[10px] uppercase tracking-wide text-navy/75">/ 100</span>
        </div>
      </div>
      <div>
        <p className={`text-lg font-semibold ${style.text}`}>{health.label}</p>
        <p className="text-sm text-navy/70">Cash-flow health this planning cycle</p>
        <p className="mt-1 text-xs text-navy/75">Explainable score from reserve, shortages, essentials, and income mix.</p>
      </div>
    </div>
  );
}

function CashTimeline({ daily }) {
  if (!daily?.length) return null;
  const values = daily.map((d) => d.endingProjectedMinor);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = Math.max(1, max - min);
  const zero = ((max - 0) / span) * 100;
  return (
    <div>
      <div className="relative flex h-32 items-end gap-[2px]" aria-hidden="true">
        <div className="absolute inset-x-0 border-t border-dashed border-navy/25" style={{ bottom: `${zero}%` }} />
        {daily.map((day) => {
          const height = ((day.endingProjectedMinor - min) / span) * 100;
          return (
            <div
              key={day.date}
              title={`${day.date}: ${formatMoney(day.endingProjectedMinor)}`}
              className={`min-w-[3px] flex-1 rounded-sm ${day.shortage ? "bg-[#8B3A3A]" : day.endingProjectedMinor < day.startingProjectedMinor ? "bg-soft" : "bg-cyan"}`}
              style={{ height: `${Math.max(2, height)}%` }}
            />
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-xs text-navy/75">
        <span>{shortDate(daily[0].date)}</span>
        <span>Dashed line = zero balance</span>
        <span>{shortDate(daily[daily.length - 1].date)}</span>
      </div>
      <details className="mt-3">
        <summary className="cursor-pointer text-sm font-medium text-cyan">See day-by-day figures</summary>
        <div className="mt-2 max-h-64 overflow-auto rounded-lg border border-soft">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Daily projected balance</caption>
            <thead className="sticky top-0 bg-powder">
              <tr>
                <th className="p-2">Date</th>
                <th className="p-2">Projected end</th>
                <th className="p-2">Safe to spend</th>
              </tr>
            </thead>
            <tbody>
              {daily.map((day) => (
                <tr key={day.date} className={`border-t border-soft ${day.shortage ? "bg-[#F8EEEE]" : ""}`}>
                  <td className="p-2">{day.date}</td>
                  <td className="p-2">{formatMoney(day.endingProjectedMinor)}</td>
                  <td className="p-2">{formatMoney(day.suggestedDiscretionaryMinor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

function TrendChart({ trend }) {
  if (!trend?.length) return null;
  const max = Math.max(1, ...trend.flatMap((t) => [t.incomeMinor, t.spendMinor]));
  return (
    <div className="mt-4 grid grid-cols-6 items-end gap-2">
      {trend.map((t) => (
        <div key={t.from} className="grid gap-1">
          <div className="flex h-28 items-end justify-center gap-1">
            <div
              className="w-2.5 rounded-t bg-soft"
              style={{ height: `${Math.max(2, (t.incomeMinor / max) * 100)}%` }}
              title={`Income ${formatMoney(t.incomeMinor)}`}
            />
            <div
              className="w-2.5 rounded-t bg-cyan"
              style={{ height: `${Math.max(2, (t.spendMinor / max) * 100)}%` }}
              title={`Spending ${formatMoney(t.spendMinor)}`}
            />
          </div>
          <p className="text-center text-[11px] text-navy/70">{monthLabel(t.from)}</p>
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [household, setHousehold] = useState(null);
  const [goals, setGoals] = useState([]);
  const [checkins, setCheckins] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      const [insights, home, goalList, checkinList] = await Promise.all([
        api("/api/insights"),
        api("/api/household"),
        api("/api/goals"),
        api("/api/checkins?days=31"),
      ]);
      setData(insights);
      setHousehold(home.household);
      setGoals(Array.isArray(goalList?.items) ? goalList.items : []);
      setCheckins(Array.isArray(checkinList?.items) ? checkinList.items : []);
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }, []);

  function handleCheckinSaved(item) {
    if (!item?.date) return;
    setCheckins((rows) => {
      const next = rows.filter((row) => row.date !== item.date);
      next.push(item);
      return next.sort((a, b) => a.date.localeCompare(b.date));
    });
  }

  useEffect(() => {
    load();
  }, [load]);

  async function clearDemo() {
    if (!window.confirm("Remove all example data? Your own records are not touched.")) return;
    setBusy(true);
    try {
      await api("/api/demo", { method: "DELETE" });
      setNotice("Example data removed.");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (error && !data) {
    return (
      <Alert title="Dashboard unavailable" tone="danger">
        {error}
      </Alert>
    );
  }
  if (!data) return <p role="status">Loading dashboard…</p>;

  const { plan, survival, health, agenda, runway, todayRow, trend, categories, today } = data;
  const isDemo = !!household?.demoSeededAt;
  const hasRecords = plan.daily.some((d) => d.events.length > 0);
  const topCategories = Object.entries(categories || {})
    .map(([key, v]) => ({ key, ...v }))
    .sort((a, b) => b.planned - a.planned)
    .slice(0, 5);
  const maxCategory = Math.max(1, ...topCategories.map((c) => c.planned));
  const groupedAgenda = agenda.reduce((acc, item) => {
    acc[item.date] = acc[item.date] || [];
    acc[item.date].push(item);
    return acc;
  }, {});
  const cycleDays = Math.max(1, dayDiff(data.period.from, data.period.to) + 1);
  const elapsedDays = Math.min(cycleDays, Math.max(0, dayDiff(data.period.from, data.today) + 1));
  const cyclePct = Math.round((elapsedDays / cycleDays) * 100);
  const nextIncomeItem = agenda.find((item) => item.type === "income");

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-navy/70">
            {household?.name || "Your household"} · {shortDate(data.period.from)} to {shortDate(data.period.to)} ·{" "}
            {household?.currency || "PKR"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className="rounded-lg bg-cyan px-4 py-2 text-sm font-semibold text-white" href="/income">
            Add income
          </Link>
          <Link className="rounded-lg border border-soft bg-white px-4 py-2 text-sm font-semibold text-navy" href="/expenses">
            Add a bill
          </Link>
        </div>
      </div>

      <div className="rounded-xl border border-soft bg-white p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-semibold">
            Cycle progress · day {elapsedDays} of {cycleDays}
          </p>
          <p className="text-xs text-navy/75">
            {nextIncomeItem
              ? `Next income: ${nextIncomeItem.label} · ${shortDate(nextIncomeItem.date)}`
              : "No income scheduled in the next two weeks"}
          </p>
        </div>
        <div className="mt-2">
          <ProgressBar value={cyclePct} label="Planning cycle progress" />
        </div>
        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-navy/75">
          <span>{cycleDays - elapsedDays} day(s) left in this cycle</span>
          <span>{agenda.length} scheduled item(s) in the next 14 days</span>
          <span>{plan.shortages.length ? `${plan.shortages.length} shortage day(s)` : "No shortage projected"}</span>
        </div>
      </div>

      {notice ? (
        <Alert title="Example data">
          <p>{notice}</p>
        </Alert>
      ) : null}
      {isDemo ? (
        <Alert title="You are viewing example data" tone="warn">
          <p>These records are clearly marked as examples. Remove them whenever you are ready to enter your real numbers.</p>
          <div className="mt-2">
            <Button type="button" variant="secondary" disabled={busy} onClick={clearDemo}>
              {busy ? "Removing…" : "Remove example data"}
            </Button>
          </div>
        </Alert>
      ) : null}
      {!hasRecords && !household?.setupComplete ? (
        <Card className="bg-powder">
          <h2 className="text-lg font-semibold">Finish your setup</h2>
          <p className="mt-1 max-w-2xl text-sm text-navy/80">
            Answer a few quick questions about your household, income, and bills. Your plan is built from your own
            numbers in about two minutes.
          </p>
          <div className="mt-3">
            <Link
              className="inline-flex min-h-11 items-center rounded-lg bg-cyan px-5 text-sm font-semibold text-white hover:bg-cyan/90"
              href="/onboarding"
            >
              Continue setup
            </Link>
          </div>
        </Card>
      ) : null}
      {!hasRecords && household?.setupComplete ? (
        <Card className="bg-powder">
          <h2 className="text-lg font-semibold">Add your first real record</h2>
          <p className="mt-1 max-w-2xl text-sm text-navy/80">
            Your setup is complete. Add the income you expect or a bill you actually pay to see the planner work with
            your own numbers.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link className="inline-flex min-h-11 items-center rounded-lg bg-cyan px-5 text-sm font-semibold text-white hover:bg-cyan/90" href="/income">
              Add income
            </Link>
            <Link className="inline-flex min-h-11 items-center rounded-lg border border-soft bg-white px-4 text-sm font-semibold text-navy" href="/expenses">
              Add a bill
            </Link>
          </div>
        </Card>
      ) : null}

      {error ? (
        <Alert title="Something went wrong" tone="danger">
          {error}
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <p className="text-sm">Confirmed cash today</p>
          <p className="mt-1 text-2xl font-semibold">{formatMoney(todayRow?.endingConfirmedMinor ?? plan.startingBalanceMinor)}</p>
          <p className="text-xs text-navy/75">Only money you recorded as received</p>
        </Card>
        <Card>
          <p className="text-sm">Projected month-end</p>
          <p className="mt-1 text-2xl font-semibold">{formatMoney(plan.totals.endingProjectedMinor)}</p>
          <p className="text-xs text-navy/75">Includes expected income — an estimate</p>
        </Card>
        <Card>
          <p className="text-sm">Safe to spend today</p>
          <p className="mt-1 text-2xl font-semibold text-cyan">{formatMoney(todayRow?.suggestedDiscretionaryMinor ?? 0)}</p>
          <p className="text-xs text-navy/75">After reserve and essentials until next confirmed income</p>
        </Card>
        <Card>
          <p className="text-sm">Days of positive runway</p>
          <p className="mt-1 text-2xl font-semibold">{runway} days</p>
          <p className="text-xs text-navy/75">From today until the projection goes below zero</p>
        </Card>
      </div>

      <DailySavingsCard
        today={today}
        todayRow={todayRow}
        checkins={checkins}
        planDaily={plan.daily}
        onSaved={handleCheckinSaved}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <h2 className="mb-4 font-semibold">Financial health</h2>
          <HealthRing health={health} />
          <ul className="mt-4 grid gap-2 text-sm">
            {health.factors.map((f) => (
              <li key={f.label} className="flex items-start gap-2">
                <span
                  className={`mt-1 h-2 w-2 shrink-0 rounded-full ${f.tone === "warn" ? "bg-[#B0892C]" : f.tone === "good" ? "bg-cyan" : "bg-soft"}`}
                  aria-hidden="true"
                />
                <span>{f.label}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">Cash timeline this cycle</h2>
            <Badge>{plan.shortages.length ? `${plan.shortages.length} shortage day(s)` : "No shortage projected"}</Badge>
          </div>
          <CashTimeline daily={plan.daily} />
        </Card>
      </div>

      {plan.shortages.length ? (
        <Alert title="Possible cash shortage" tone="warn">
          <p>
            {plan.shortages[0].label || "Shortfall"} on {plan.shortages[0].date}. Review the monthly plan before spending.
          </p>
          <Link className="mt-2 inline-block text-sm font-semibold underline" href="/plan">
            Open the monthly plan
          </Link>
        </Alert>
      ) : (
        <Alert title="No shortage flagged in this cycle">
          <p>{survival.headline}. This is a projection from the dates and amounts you entered, not a guarantee.</p>
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="font-semibold">Next 14 days</h2>
          {Object.keys(groupedAgenda).length ? (
            <ul className="mt-3 grid gap-3">
              {Object.entries(groupedAgenda).map(([date, items]) => (
                <li key={date}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-navy/75">{shortDate(date)}</p>
                  <ul className="mt-1 grid gap-1 text-sm">
                    {items.map((item, index) => (
                      <li key={`${item.label}-${index}`} className="flex flex-wrap items-baseline justify-between gap-2">
                        <span>
                          {item.type === "income" ? "+" : "−"} {item.label}
                          {item.essential ? " · essential" : ""}
                        </span>
                        <span className={item.type === "income" ? "text-cyan" : "text-navy"}>
                          {formatMoney(item.amountMinor)}
                          {item.confirmed ? " · done" : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-3">
              <Empty title="Nothing scheduled">Add income and bills to see the next two weeks.</Empty>
            </div>
          )}
        </Card>

        <Card>
          <h2 className="font-semibold">Where the money goes</h2>
          <p className="text-xs text-navy/75">Planned bill amounts by category this cycle</p>
          {topCategories.length ? (
            <ul className="mt-3 grid gap-3">
              {topCategories.map((c) => (
                <li key={c.key}>
                  <div className="flex justify-between gap-2 text-sm">
                    <span className="capitalize">{c.key.replaceAll("_", " ")}</span>
                    <span>
                      {formatMoney(c.planned)} <span className="text-navy/75">· paid {formatMoney(c.paid)}</span>
                    </span>
                  </div>
                  <div className="mt-1 h-2 rounded bg-powder" aria-hidden="true">
                    <div className="h-2 rounded bg-soft" style={{ width: `${Math.round((c.planned / maxCategory) * 100)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-3">
              <Empty title="No bills yet">Add rent, utilities, and groceries to see the split.</Empty>
            </div>
          )}
          <Link className="mt-4 inline-block text-sm font-semibold text-cyan" href="/reports">
            Open full reports →
          </Link>
        </Card>
      </div>

      <Card>
        <h2 className="font-semibold">Savings goals</h2>
        <p className="text-xs text-navy/75">How far each goal has come, based on what you have set aside.</p>
        {goals.length ? (
          <ul className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {goals.slice(0, 6).map((goal) => {
              const pct = goal.targetMinor > 0 ? Math.min(100, Math.round((goal.savedMinor / goal.targetMinor) * 100)) : 0;
              return (
                <li key={goal._id}>
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="font-medium">{goal.name}</span>
                    <span className="text-navy/70">{pct}%</span>
                  </div>
                  <div className="mt-1 h-2 rounded bg-powder" aria-hidden="true">
                    <div className="h-2 rounded bg-cyan" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-navy/70">
                    {formatMoney(goal.savedMinor)} of {formatMoney(goal.targetMinor)} · by {shortDate(goal.targetDate)}
                  </p>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="mt-3">
            <Empty title="No savings goals yet">Add a goal to see progress here.</Empty>
          </div>
        )}
        <Link className="mt-4 inline-block text-sm font-semibold text-cyan" href="/goals">
          Manage savings goals →
        </Link>
      </Card>

      <Card>
        <h2 className="font-semibold">Last six planning cycles</h2>
        <p className="text-xs text-navy/75">
          Received income versus recorded spending. Unpaid bills are not counted as spending.
        </p>
        <TrendChart trend={trend} />
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-navy/70">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-soft" aria-hidden="true" /> Received income
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-cyan" aria-hidden="true" /> Spending
          </span>
        </div>
        <table className="mt-4 w-full text-left text-sm">
          <caption className="sr-only">Six-cycle history</caption>
          <thead>
            <tr className="text-xs uppercase tracking-wide text-navy/75">
              <th className="p-1">Cycle</th>
              <th className="p-1">Received</th>
              <th className="p-1">Spent</th>
              <th className="p-1">Projected end</th>
            </tr>
          </thead>
          <tbody>
            {trend.map((t) => (
              <tr key={t.from} className="border-t border-soft">
                <td className="p-1">{monthLabel(t.from)}</td>
                <td className="p-1">{formatMoney(t.incomeMinor)}</td>
                <td className="p-1">{formatMoney(t.spendMinor)}</td>
                <td className="p-1">{formatMoney(t.endingProjectedMinor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["/plan", "Monthly plan", "Day-by-day cash and shortages"],
          ["/simulator", "What-if", "Delay salary or add a shock"],
          ["/goals", "Goals", "Test savings targets"],
          ["/survival", "Survival budget", "Cover essentials only"],
        ].map(([href, title, text]) => (
          <Link key={href} href={href} className="rounded-xl border border-soft bg-white p-4 hover:border-cyan">
            <p className="font-semibold">{title}</p>
            <p className="text-sm text-navy/70">{text}</p>
          </Link>
        ))}
      </div>
      <p className="text-xs text-navy/75">
        Projections use the amounts and dates you enter. They are estimates, not financial advice. Today is {today}.
      </p>
    </div>
  );
}
