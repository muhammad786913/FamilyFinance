"use client";

import { useEffect, useState } from "react";
import { Alert, Card } from "@/components/ui";
import { api, formatMoney } from "@/lib/format";

export default function PlanPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api("/api/plan")
      .then(setData)
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <Alert title="Plan unavailable" tone="danger">{error}</Alert>;
  if (!data) return <p>Loading monthly plan…</p>;
  const { plan } = data;

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold">Monthly plan</h1>
      <Alert title="Estimates are labelled">
        Suggested daily spending is an estimate after your emergency reserve and essential bills due before the next confirmed income. It is not a guaranteed safe amount.
      </Alert>
      {plan.missedEssentials.length ? (
        <Alert title="Essential payments may be missed" tone="danger">
          {plan.missedEssentials.map((m) => `${m.date}: ${m.label}`).join(" · ")}
        </Alert>
      ) : null}
      <Card>
        <h2 className="font-semibold">Weeks</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {plan.weeks.map((w) => (
            <li key={w.start} className="rounded-lg bg-powder p-3">
              {w.start} to {w.end}: projected end {formatMoney(w.endingProjectedMinor)}
              {w.shortages ? ` · ${w.shortages} short day(s)` : ""}
            </li>
          ))}
        </ul>
      </Card>
      <Card className="overflow-x-auto">
        <h2 className="font-semibold">Daily cash flow</h2>
        <table className="mt-3 w-full min-w-[40rem] text-left text-sm">
          <thead>
            <tr>
              <th className="p-2">Date</th>
              <th className="p-2">Start (projected)</th>
              <th className="p-2">End (projected)</th>
              <th className="p-2">Suggested spend (estimate)</th>
              <th className="p-2">Events</th>
            </tr>
          </thead>
          <tbody>
            {plan.daily.map((d) => (
              <tr key={d.date} className="border-t border-soft">
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
      </Card>
    </div>
  );
}
