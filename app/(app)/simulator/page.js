"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, Button, Card, Empty } from "@/components/ui";
import { MoneyForm } from "@/components/MoneyForm";
import { api, formatMoney } from "@/lib/format";

export default function SimulatorPage() {
  const [result, setResult] = useState(null);
  const [scenarios, setScenarios] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const loadScenarios = useCallback(async () => {
    try {
      const data = await api("/api/simulate");
      setScenarios(data.items || []);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    loadScenarios();
  }, [loadScenarios]);

  async function run(body) {
    setBusy(true);
    try {
      setResult(await api("/api/simulate", { method: "POST", body }));
      setError("");
      await loadScenarios();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold">What-if simulator</h1>
      <p className="text-sm">
        Scenarios are temporary unless you tick apply or save. Applying only adds the confirmed extra expense to your real records.
      </p>
      <Card>
        <MoneyForm
          submitLabel={busy ? "Running…" : "Run scenario"}
          onSubmit={async (body) => {
            body.save = !!body.save;
            body.apply = !!body.apply;
            body.name = body.name || "Scenario";
            await run(body);
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
            { name: "save", label: "Save this scenario", type: "checkbox", defaultChecked: true },
            { name: "apply", label: "Apply extra expense to real records", type: "checkbox" },
          ]}
        />
      </Card>
      {error ? (
        <Alert title="Could not simulate" tone="danger">
          {error}
        </Alert>
      ) : null}
      {result ? (
        <Card>
          <h2 className="font-semibold">Comparison with your current plan</h2>
          <ul className="mt-3 space-y-1 text-sm">
            <li>Projected end change: {formatMoney(result.diff.endingProjectedDeltaMinor)}</li>
            <li>Unpaid bills change: {formatMoney(result.diff.unpaidDeltaMinor)}</li>
            <li>Shortage count change: {result.diff.shortageCountDelta}</li>
            <li>Missed essentials change: {result.diff.missedEssentialDelta}</li>
          </ul>
          <p className="mt-3 text-sm text-navy/70">
            Current plan ends at {formatMoney(result.baseline.totals.endingProjectedMinor)}; simulated ends at{" "}
            {formatMoney(result.simulated.totals.endingProjectedMinor)}.
          </p>
        </Card>
      ) : null}
      <Card>
        <h2 className="font-semibold">Saved scenarios</h2>
        {scenarios.length ? (
          <ul className="mt-3 grid gap-3">
            {scenarios.map((s) => (
              <li key={s._id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-powder p-3 text-sm">
                <div>
                  <p className="font-semibold">{s.name}</p>
                  <p className="text-navy/70">
                    {new Date(s.createdAt).toLocaleDateString("en-CA")} ·{" "}
                    {s.payload?.extraExpense
                      ? `Extra ${s.payload.extraExpense.name} ${formatMoney(s.payload.extraExpense.amountMinor)}`
                      : s.payload?.expenseCategory
                        ? `Raise ${s.payload.expenseCategory} by ${s.payload.expenseMultiplier}x`
                        : s.payload?.delayDays
                          ? `Delay income ${s.payload.delayDays} day(s)`
                          : "No changes recorded"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={async () => {
                      setBusy(true);
                      try {
                        setResult(await api("/api/simulate", { method: "POST", body: { scenarioId: s._id } }));
                        setError("");
                      } catch (err) {
                        setError(err.message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Run again
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    onClick={async () => {
                      if (!window.confirm(`Discard scenario "${s.name}"? Real records are not affected.`)) return;
                      await api(`/api/simulate/${s._id}`, { method: "DELETE" });
                      await loadScenarios();
                    }}
                  >
                    Discard
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-3">
            <Empty title="No saved scenarios">Run a scenario with Save ticked to keep it here.</Empty>
          </div>
        )}
      </Card>
    </div>
  );
}
