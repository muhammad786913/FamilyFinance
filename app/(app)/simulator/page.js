"use client";

import { useState } from "react";
import { Alert, Card } from "@/components/ui";
import { MoneyForm } from "@/components/MoneyForm";
import { api, formatMoney } from "@/lib/format";

export default function SimulatorPage() {
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold">What-if simulator</h1>
      <p className="text-sm">Scenarios stay temporary unless you check apply. Applying currently adds only an extra expense you confirm.</p>
      <Card>
        <MoneyForm
          submitLabel="Run scenario"
          onSubmit={async (body) => {
            try {
              body.save = true;
              body.apply = !!body.apply;
              body.name = body.name || "Scenario";
              setResult(await api("/api/simulate", { method: "POST", body }));
              setError("");
            } catch (err) {
              setError(err.message);
            }
          }}
          fields={[
            { name: "name", label: "Scenario name", required: true },
            { name: "delayDays", label: "Delay income by days", type: "number" },
            { name: "delayIncomeId", label: "Income id to delay (from income page)" },
            { name: "expenseCategory", label: "Raise category", type: "select", options: [["", "None"], ["groceries", "Groceries"], ["medical", "Medical"]] },
            { name: "expenseMultiplier", label: "Category multiplier (e.g. 1.2)", type: "number", step: "0.1" },
            { name: "extraName", label: "Unexpected expense name" },
            { name: "extraAmount", label: "Unexpected amount (PKR)", type: "number", step: "0.01" },
            { name: "extraDate", label: "Unexpected date", type: "date" },
            { name: "apply", label: "Apply extra expense to real records", type: "checkbox" },
          ]}
        />
      </Card>
      {error ? <Alert title="Could not simulate" tone="danger">{error}</Alert> : null}
      {result ? (
        <Card>
          <h2 className="font-semibold">Comparison</h2>
          <ul className="mt-3 space-y-1 text-sm">
            <li>Projected end change: {formatMoney(result.diff.endingProjectedDeltaMinor)}</li>
            <li>Unpaid bills change: {formatMoney(result.diff.unpaidDeltaMinor)}</li>
            <li>Shortage count change: {result.diff.shortageCountDelta}</li>
            <li>Missed essentials change: {result.diff.missedEssentialDelta}</li>
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
