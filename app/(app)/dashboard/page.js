"use client";

import { useEffect, useState } from "react";
import { Alert, Card, Empty } from "@/components/ui";
import { api, formatMoney } from "@/lib/format";

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api("/api/plan")
      .then(setData)
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <Alert title="Dashboard unavailable" tone="danger">{error}</Alert>;
  if (!data) return <p>Loading dashboard…</p>;

  const { plan, survival } = data;
  const upcomingIncome = plan.daily.flatMap((d) => d.events.filter((e) => e.type === "income")).slice(0, 5);
  const upcomingBills = plan.daily.flatMap((d) => d.events.filter((e) => e.type === "expense" && !e.confirmed)).slice(0, 5);

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <p className="text-sm">Confirmed cash (projected end uses estimates too)</p>
          <p className="mt-2 text-2xl font-semibold">{formatMoney(plan.totals.endingConfirmedMinor)}</p>
        </Card>
        <Card>
          <p className="text-sm">Projected month-end</p>
          <p className="mt-2 text-2xl font-semibold">{formatMoney(plan.totals.endingProjectedMinor)}</p>
          <p className="text-xs text-navy/70">Estimate, not a guaranteed result</p>
        </Card>
        <Card>
          <p className="text-sm">Survival budget</p>
          <p className="mt-2 font-semibold">{survival.headline}</p>
        </Card>
      </div>
      {plan.shortages.length ? (
        <Alert title="Possible cash shortage" tone="warn">
          {plan.shortages[0].label} on {plan.shortages[0].date}. Review the monthly plan before spending.
        </Alert>
      ) : (
        <Alert title="No shortage flagged in this period">{survival.headline}</Alert>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <h2 className="font-semibold">Upcoming income</h2>
          {upcomingIncome.length ? (
            <ul className="mt-3 space-y-2 text-sm">
              {upcomingIncome.map((e) => (
                <li key={`${e.id}-${e.date}`}>
                  {e.date} · {e.label} · {formatMoney(e.amountMinor)} {e.confirmed ? "(received)" : "(expected)"}
                </li>
              ))}
            </ul>
          ) : (
            <Empty title="No income scheduled">Add income sources to see pay dates.</Empty>
          )}
        </Card>
        <Card>
          <h2 className="font-semibold">Upcoming bills</h2>
          {upcomingBills.length ? (
            <ul className="mt-3 space-y-2 text-sm">
              {upcomingBills.map((e) => (
                <li key={`${e.id}-${e.date}`}>
                  {e.date} · {e.label} · {formatMoney(e.amountMinor)}
                  {e.essential ? " · essential" : ""}
                </li>
              ))}
            </ul>
          ) : (
            <Empty title="No bills scheduled">Add rent, utilities, and other due dates.</Empty>
          )}
        </Card>
      </div>
    </div>
  );
}
