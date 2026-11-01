"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, Badge, Button, Card, Empty, PageHeader, StatCard } from "@/components/ui";
import { MoneyForm } from "@/components/MoneyForm";
import { api, formatMoney } from "@/lib/format";

function shortDate(ymd) {
  return new Date(`${ymd}T00:00:00Z`).toLocaleDateString("en-PK", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

const tone = (value, goodWhenPositive = true) => {
  if (!value) return "default";
  return value > 0 === goodWhenPositive ? "cyan" : "danger";
};

export default function SimulatorPage() {
  const [result, setResult] = useState(null);
  const [scenarios, setScenarios] = useState([]);
  const [plan, setPlan] = useState(null);
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
    api("/api/plan")
      .then((data) => setPlan(data.plan))
      .catch(() => setPlan(null));
  }, [loadScenarios]);

  async function run(body) {
    setBusy(true);
    try {
      setResult(await api("/api/simulate", { method: "POST", body }));
      setError("");
      await loadScenarios();
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Test before you commit"
        title="What-if simulator"
        description="Scenarios are temporary unless you tick apply or save. Applying only adds the confirmed extra expense to your real records."
        actions={<Badge>{scenarios.length} saved scenario(s)</Badge>}
      />

      {plan ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Current projected end"
            value={formatMoney(plan.totals.endingProjectedMinor)}
            hint={`${shortDate(plan.startDate)} – ${shortDate(plan.endDate)}`}
          />
          <StatCard label="Unpaid bills" value={formatMoney(plan.totals.unpaidBillsMinor)} hint="Before any scenario" />
          <StatCard
            label="Shortage days"
            value={plan.shortages.length}
            hint={plan.shortages.length ? "Already flagged in the plan" : "No shortage today"}
            tone={plan.shortages.length ? "warn" : "cyan"}
          />
          <StatCard
            label="Projected surplus"
            value={formatMoney(plan.totals.projectedSurplusMinor)}
            hint="Month-end cash minus reserve"
          />
        </div>
      ) : null}

      <Card>
        <h2 className="mb-4 font-semibold">Build a scenario</h2>
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
        <p className="mt-3 text-xs text-navy/75">
          Tip: an unexpected amount of 0 is kept as an explicit zero. Leave the field blank to skip the extra expense.
        </p>
      </Card>

      {error ? (
        <Alert title="Could not simulate" tone="danger">
          {error}
        </Alert>
      ) : null}

      {result ? (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">Comparison with your current plan</h2>
            <Badge>
              {result.diff.shortageCountDelta > 0 || result.diff.missedEssentialDelta > 0
                ? "This scenario makes the month tighter"
                : "This scenario does not add a shortage"}
            </Badge>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Projected end change"
              value={formatMoney(result.diff.endingProjectedDeltaMinor)}
              hint="Simulated minus current plan"
              tone={tone(result.diff.endingProjectedDeltaMinor, true) === "cyan" ? "cyan" : "danger"}
            />
            <StatCard
              label="Unpaid bills change"
              value={formatMoney(result.diff.unpaidDeltaMinor)}
              hint="Extra bills left unpaid"
              tone={tone(result.diff.unpaidDeltaMinor, false) === "cyan" ? "cyan" : "danger"}
            />
            <StatCard
              label="Shortage count change"
              value={result.diff.shortageCountDelta > 0 ? `+${result.diff.shortageCountDelta}` : result.diff.shortageCountDelta}
              hint="Days below zero"
              tone={result.diff.shortageCountDelta > 0 ? "danger" : "default"}
            />
            <StatCard
              label="Missed essentials change"
              value={result.diff.missedEssentialDelta > 0 ? `+${result.diff.missedEssentialDelta}` : result.diff.missedEssentialDelta}
              hint="Essential payments at risk"
              tone={result.diff.missedEssentialDelta > 0 ? "danger" : "default"}
            />
          </div>

          <div className="mt-4 rounded-lg bg-powder p-3">
            <p className="text-sm">
              Current plan ends at <strong>{formatMoney(result.baseline.totals.endingProjectedMinor)}</strong>; this scenario
              ends at <strong>{formatMoney(result.simulated.totals.endingProjectedMinor)}</strong>.
            </p>
            <div className="mt-2 grid gap-2 text-xs text-navy/70 sm:grid-cols-2">
              <p>Baseline shortage days: {result.baseline.shortages.length}</p>
              <p>Scenario shortage days: {result.simulated.shortages.length}</p>
              <p>Baseline projected surplus: {formatMoney(result.baseline.totals.projectedSurplusMinor)}</p>
              <p>Scenario projected surplus: {formatMoney(result.simulated.totals.projectedSurplusMinor)}</p>
            </div>
            {result.simulated.shortages.length ? (
              <p className="mt-2 text-xs font-semibold text-[#8B3A3A]">
                First shortage: {shortDate(result.simulated.shortages[0].date)} · {result.simulated.shortages[0].label || "shortfall"}
              </p>
            ) : null}
          </div>
        </Card>
      ) : null}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Saved scenarios</h2>
          {scenarios.length ? (
            <span className="text-xs text-navy/75">
              {scenarios.filter((s) => s.payload?.extraExpense).length} with a real extra expense
            </span>
          ) : null}
        </div>
        {scenarios.length ? (
          <ul className="mt-3 grid gap-3">
            {scenarios.map((s) => (
              <li key={s._id} className="rounded-lg border border-soft bg-powder p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
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
