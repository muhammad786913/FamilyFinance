"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, Button, Card, Empty, PageHeader, ProgressBar, StatCard } from "@/components/ui";
import { MoneyForm } from "@/components/MoneyForm";
import { api, formatMoney } from "@/lib/format";

const FIELDS = [
  { name: "name", label: "Goal name", required: true },
  { name: "target", label: "Target (PKR)", type: "number", step: "0.01", required: true },
  { name: "saved", label: "Already saved (PKR)", type: "number", step: "0.01" },
  { name: "targetDate", label: "Target date", type: "date", required: true },
  { name: "contribution", label: "Planned contribution (PKR)", type: "number", step: "0.01" },
];

export default function GoalsPage() {
  const [items, setItems] = useState([]);
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    try {
      const [g, p] = await Promise.all([api("/api/goals?limit=100"), api("/api/plan")]);
      setItems(g.items);
      setPlan(p.plan);
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const surplus = plan?.totals.projectedSurplusMinor || 0;
  const totalTarget = items.reduce((sum, goal) => sum + goal.targetMinor, 0);
  const totalSaved = items.reduce((sum, goal) => sum + goal.savedMinor, 0);
  const overallPct = totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0;
  const monthlyPlan = items.reduce((sum, goal) => sum + (goal.contributionMinor || 0), 0);
  const nextGoal = [...items].sort((a, b) => String(a.targetDate).localeCompare(String(b.targetDate)))[0];
  const covered = items.filter((goal) => surplus > 0 && (goal.contributionMinor || 0) <= surplus).length;

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Savings"
        title="Goals and savings"
        description="Saved amounts you record are actual. Feasibility is checked against this cycle’s projected surplus."
      />
      {error ? (
        <Alert title="Error" tone="danger">
          {error}
        </Alert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Goals tracked" value={items.length} hint={`${covered} covered by this cycle’s surplus`} />
        <StatCard label="Total target" value={formatMoney(totalTarget)} hint="Across all goals" />
        <StatCard label="Set aside" value={formatMoney(totalSaved)} hint={`${overallPct}% of all targets`} tone="cyan" />
        <StatCard
          label="Planned monthly saving"
          value={formatMoney(monthlyPlan)}
          hint={nextGoal ? `Next deadline: ${nextGoal.targetDate}` : "Add a target date to track deadlines"}
        />
      </div>

      <Card>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">Overall progress</h2>
          <span className="text-sm font-semibold text-cyan">{overallPct}%</span>
        </div>
        <div className="mt-3">
          <ProgressBar value={overallPct} label="Overall savings progress" />
        </div>
        <p className="mt-2 text-xs text-navy/75">
          {formatMoney(totalSaved)} saved of {formatMoney(totalTarget)}. Projected surplus this cycle: {formatMoney(surplus)}.
        </p>
      </Card>

      <Alert title="Actual vs projected">
        Saved amounts you record are actual. Month-end surplus {formatMoney(surplus)} is a projection. Do not save money needed for
        upcoming essential bills.
      </Alert>
      <Card>
        <MoneyForm
          submitLabel="Add goal"
          fields={FIELDS}
          onSubmit={async (body) => {
            await api("/api/goals", { method: "POST", body });
            await load();
          }}
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
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{g.name}</p>
                    <p className="text-sm">
                      {formatMoney(g.savedMinor)} saved of {formatMoney(g.targetMinor)} by {g.targetDate}
                    </p>
                    <p className="text-sm">
                      {feasible
                        ? "Projected surplus may cover the planned contribution this period."
                        : `Need ${formatMoney(left)} more. If surplus is too small, extend the date or lower the target.`}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      aria-expanded={editing === g._id}
                      onClick={() => setEditing(editing === g._id ? null : g._id)}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      onClick={async () => {
                        if (!window.confirm(`Delete goal "${g.name}"?`)) return;
                        await api(`/api/goals/${g._id}`, { method: "DELETE" });
                        await load();
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
                <div className="mt-3">
                  <ProgressBar
                    value={g.targetMinor > 0 ? Math.min(100, Math.round((g.savedMinor / g.targetMinor) * 100)) : 0}
                    tone={feasible ? "cyan" : "warn"}
                    label={`${g.name} savings progress`}
                  />
                  <p className="mt-1 text-xs text-navy/75">
                    {g.targetMinor > 0 ? Math.min(100, Math.round((g.savedMinor / g.targetMinor) * 100)) : 0}% funded ·{" "}
                    {formatMoney(Math.max(0, left))} remaining
                  </p>
                </div>
                {editing === g._id ? (
                  <div className="mt-4 rounded-lg border border-soft p-3">
                    <MoneyForm
                      key={`edit-${g._id}`}
                      fields={FIELDS}
                      submitLabel="Save changes"
                      values={{
                        name: g.name,
                        target: g.targetMinor / 100,
                        saved: g.savedMinor / 100,
                        targetDate: g.targetDate,
                        contribution: (g.contributionMinor || 0) / 100,
                      }}
                      onSubmit={async (body) => {
                        await api(`/api/goals/${g._id}`, { method: "PATCH", body });
                        setEditing(null);
                        await load();
                      }}
                    />
                  </div>
                ) : null}
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
