"use client";

import { useEffect, useState } from "react";
import { Alert, Card } from "@/components/ui";
import { api, formatMoney } from "@/lib/format";

export default function ReportsPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api("/api/reports")
      .then(setData)
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <Alert title="Report unavailable" tone="danger">{error}</Alert>;
  if (!data) return <p>Loading report…</p>;

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold">Reports</h1>
      <p className="text-sm">Projected figures are labelled. Actual savings are amounts you recorded on the household.</p>
      <div className="grid gap-3 md:grid-cols-2">
        {[
          ["Starting balance", data.startingBalanceMinor],
          ["Income received", data.confirmedIncomeMinor],
          ["Expected remaining income", data.expectedIncomeMinor],
          ["Actual spending", data.actualSpendMinor],
          ["Unpaid bills", data.unpaidBillsMinor],
          ["Projected ending balance", data.endingProjectedMinor],
          ["Actual savings recorded", data.actualSavingsMinor],
          ["Projected surplus after reserve", data.projectedSurplusMinor],
        ].map(([label, value]) => (
          <Card key={label}>
            <p className="text-sm">{label}</p>
            <p className="text-xl font-semibold">{formatMoney(value)}</p>
          </Card>
        ))}
      </div>
      <Card>
        <h2 className="font-semibold">Categories over planned amount</h2>
        {data.overCategories.length ? (
          <ul className="mt-3 text-sm">
            {data.overCategories.map((c) => (
              <li key={c.category}>
                {c.category}: over by {formatMoney(c.overMinor)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm">No category has exceeded its planned amount yet.</p>
        )}
      </Card>
    </div>
  );
}
