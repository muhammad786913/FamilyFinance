"use client";

import { useEffect, useState } from "react";
import { Alert, Badge, Card, PageHeader, ProgressBar, StatCard } from "@/components/ui";
import { api, formatMoney } from "@/lib/format";

function shortDate(ymd) {
  return new Date(`${ymd}T00:00:00Z`).toLocaleDateString("en-PK", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export default function PlanPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api("/api/plan")
      .then(setData)
      .catch((err) => setError(err.message));
  }, []);

  if (error)
    return (
      <Alert title="Plan unavailable" tone="danger">
        {error}
      </Alert>
    );
  if (!data) return <p role="status">Loading monthly plan…</p>;
  const { plan } = data;

  const todayRow = plan.daily.find((day) => day.date === plan.asOfDate) || plan.daily[0];
  const maxWeekEnd = Math.max(1, ...plan.weeks.map((week) => Math.abs(week.endingProjectedMinor)));
  const incomeDays = plan.daily.filter((day) => day.events.some((event) => event.type === "income"));
  const nextIncome = incomeDays.find((day) => day.date >= plan.asOfDate) || incomeDays[0];

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Cash calendar"
        title="Monthly plan"
        description={`${shortDate(plan.startDate)} to ${shortDate(plan.endDate)} · projections use the dates and amounts you entered.`}
        actions={
          <Badge>{plan.shortages.length ? `${plan.shortages.length} shortage day(s)` : "No shortage projected"}</Badge>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Confirmed cash today"
          value={formatMoney(todayRow?.endingConfirmedMinor ?? plan.startingBalanceMinor)}
          hint="Received money only"
        />
        <StatCard
          label="Projected month-end"
          value={formatMoney(plan.totals.endingProjectedMinor)}
          hint="Includes expected income"
          tone="cyan"
        />
        <StatCard
          label="Suggested spend today"
          value={formatMoney(todayRow?.suggestedDiscretionaryMinor ?? 0)}
          hint="After reserve and upcoming essentials"
        />
        <StatCard
          label="Unpaid bills"
          value={formatMoney(plan.totals.unpaidBillsMinor)}
          hint={`${plan.missedEssentials.length} essential payment(s) at risk`}
          tone={plan.missedEssentials.length ? "danger" : "default"}
        />
      </div>

      <Alert title="Estimates are labelled">
        Suggested daily spending is an estimate after your emergency reserve and essential bills due before the next
        confirmed income. It is not a guaranteed safe amount.
      </Alert>

      {plan.missedEssentials.length ? (
        <Alert title="Essential payments may be missed" tone="danger">
          {plan.missedEssentials.map((m) => `${shortDate(m.date)}: ${m.label}`).join(" · ")}
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">Weeks this cycle</h2>
            <span className="text-xs text-navy/75">Projected end of each week</span>
          </div>
          <ul className="mt-3 grid gap-3">
            {plan.weeks.map((week) => {
              const pct = Math.round((Math.abs(week.endingProjectedMinor) / maxWeekEnd) * 100);
              const tight = week.endingProjectedMinor < 0;
              return (
                <li key={week.start} className="rounded-lg border border-soft p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                    <span className="font-medium">
                      {shortDate(week.start)} – {shortDate(week.end)}
                    </span>
                    <span className={tight ? "font-semibold text-[#8B3A3A]" : "font-semibold"}>
                      {formatMoney(week.endingProjectedMinor)}
                    </span>
                  </div>
                  <div className="mt-2">
                    <ProgressBar value={pct} tone={tight ? "danger" : week.shortages ? "warn" : "cyan"} label={`Week ending ${week.end}`} />
                  </div>
                  <p className="mt-1 text-xs text-navy/75">
                    {week.shortages ? `${week.shortages} short day(s) — move an optional bill if you can.` : "Covers bills and essentials in this week."}
                  </p>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card>
          <h2 className="font-semibold">Next income</h2>
          {nextIncome ? (
            <>
              <p className="mt-3 text-2xl font-semibold text-cyan">{shortDate(nextIncome.date)}</p>
              <ul className="mt-3 grid gap-2 text-sm">
                {nextIncome.events
                  .filter((event) => event.type === "income")
                  .map((event) => (
                    <li key={event.label} className="flex items-center justify-between gap-2 rounded-lg bg-powder px-3 py-2">
                      <span>{event.label}</span>
                      <span className="font-semibold">{formatMoney(event.amountMinor)}</span>
                    </li>
                  ))}
              </ul>
              <p className="mt-3 text-xs text-navy/75">
                Expected income is projected on its date. Mark it received on the income page to count it as cash.
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-navy/70">No income is scheduled in this cycle yet.</p>
          )}
        </Card>
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Daily cash flow</h2>
          <span className="text-xs text-navy/75">{plan.daily.length} days</span>
        </div>

        {/* Mobile: readable stacked rows instead of a wide table. */}
        <ul className="mt-3 grid gap-2 md:hidden">
          {plan.daily.map((day) => (
            <li
              key={day.date}
              className={`rounded-lg border p-3 text-sm ${day.shortage ? "border-[#8B3A3A]/40 bg-[#F8EEEE]" : "border-soft"}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{shortDate(day.date)}</span>
                <span className="text-xs text-navy/75">{formatMoney(day.suggestedDiscretionaryMinor)} safe to spend</span>
              </div>
              <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-navy/70">
                <span>
                  Start {formatMoney(day.startingProjectedMinor)} → end{" "}
                  <strong className="text-navy">{formatMoney(day.endingProjectedMinor)}</strong>
                </span>
              </div>
              {day.events.length ? (
                <p className="mt-1 text-xs text-navy/70">
                  {day.events.map((e) => `${e.type === "income" ? "+" : "−"} ${e.label}`).join(" · ")}
                </p>
              ) : null}
              {day.shortage ? <p className="mt-1 text-xs font-semibold text-[#8B3A3A]">Shortage projected</p> : null}
            </li>
          ))}
        </ul>

        <div className="mt-3 hidden overflow-x-auto md:block">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <caption className="sr-only">Daily projected cash flow</caption>
            <thead>
              <tr className="bg-powder">
                <th className="p-2">Date</th>
                <th className="p-2">Start (projected)</th>
                <th className="p-2">End (projected)</th>
                <th className="p-2">Suggested spend (estimate)</th>
                <th className="p-2">Events</th>
              </tr>
            </thead>
            <tbody>
              {plan.daily.map((d) => (
                <tr key={d.date} className={`border-t border-soft ${d.shortage ? "bg-[#F8EEEE]" : ""}`}>
                  <td className="p-2">{d.date}</td>
                  <td className="p-2">{formatMoney(d.startingProjectedMinor)}</td>
                  <td className="p-2">{formatMoney(d.endingProjectedMinor)}</td>
                  <td className="p-2">{formatMoney(d.suggestedDiscretionaryMinor)}</td>
                  <td className="p-2">
                    {d.events.map((e) => `${e.type === "income" ? "+" : "-"} ${e.label}`).join(", ") || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
