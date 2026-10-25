"use client";

import { useEffect, useState } from "react";
import { Alert, Card, Empty } from "@/components/ui";
import { MoneyForm } from "@/components/MoneyForm";
import { api, formatMoney } from "@/lib/format";

export default function GoalsPage() {
  const [items, setItems] = useState([]);
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState("");

  async function load() {
    try {
      const [g, p] = await Promise.all([api("/api/goals"), api("/api/plan")]);
      setItems(g.items);
      setPlan(p.plan);
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const surplus = plan?.totals.projectedSurplusMinor || 0;

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold">Goals and savings</h1>
      {error ? <Alert title="Error" tone="danger">{error}</Alert> : null}
      <Alert title="Actual vs projected">
        Saved amounts you record are actual. Month-end surplus {formatMoney(surplus)} is a projection. Do not save money needed for upcoming essential bills.
      </Alert>
      <Card>
        <MoneyForm
          submitLabel="Add goal"
          onSubmit={async (body) => {
            await api("/api/goals", { method: "POST", body });
            await load();
          }}
          fields={[
            { name: "name", label: "Goal name", required: true },
            { name: "target", label: "Target (PKR)", type: "number", step: "0.01", required: true },
            { name: "saved", label: "Already saved (PKR)", type: "number", step: "0.01" },
            { name: "targetDate", label: "Target date", type: "date", required: true },
            { name: "contribution", label: "Planned contribution (PKR)", type: "number", step: "0.01" },
          ]}
        />
      </Card>
      {!items.length ? <Empty title="No goals yet">Add an emergency fund, education, or purchase target.</Empty> : null}
      <ul className="grid gap-3">
        {items.map((g) => {
          const left = g.targetMinor - g.savedMinor;
          const feasible = surplus > 0 && (g.contributionMinor || 0) <= surplus;
          return (
            <li key={g._id}>
              <Card>
                <p className="font-semibold">{g.name}</p>
                <p className="text-sm">
                  {formatMoney(g.savedMinor)} saved of {formatMoney(g.targetMinor)} by {g.targetDate}
                </p>
                <p className="text-sm">
                  {feasible
                    ? "Projected surplus may cover the planned contribution this period."
                    : `Need ${formatMoney(left)} more. If surplus is too small, extend the date or lower the target.`}
                </p>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
