"use client";

import { useEffect, useState } from "react";
import { Alert, Card, PageHeader, ProgressBar, StatCard } from "@/components/ui";
import { MoneyForm } from "@/components/MoneyForm";
import { api, formatMoney } from "@/lib/format";

const BREAKDOWN_LABELS = {
  housing: "Housing",
  food: "Food",
  utilities: "Utilities",
  transport: "Transport",
  medical: "Medical",
  education: "Education",
  other: "Other essentials",
};

export default function SurvivalPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  async function load() {
    try {
      setData(await api("/api/survival"));
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const r = data?.result;
  const tone = r?.status === "exceeds" ? "danger" : r?.status === "tight" ? "warn" : "info";
  const rows = r
    ? Object.entries(r.breakdown || {})
        .map(([key, value]) => ({ key, value }))
        .sort((a, b) => b.value - a.value)
    : [];
  const maxRow = Math.max(1, ...rows.map((row) => row.value));

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Essentials only"
        title="Minimum survival budget"
        description="This uses your household size, location, and essential costs. It is not a poverty-line test and does not label a household as unable to survive."
      />

      {error ? (
        <Alert title="Error" tone="danger">
          {error}
        </Alert>
      ) : null}

      {r ? (
        <>
          <Alert title={r.headline} tone={tone}>
            Monthly essentials {formatMoney(r.monthlyEssentialMinor)} · weekly {formatMoney(r.weeklyMinor)} · daily{" "}
            {formatMoney(r.dailyMinor)}
          </Alert>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Monthly essentials"
              value={formatMoney(r.monthlyEssentialMinor)}
              hint={`${r.location} · household of ${r.householdSize}`}
            />
            <StatCard label="Weekly floor" value={formatMoney(r.weeklyMinor)} hint="Monthly essentials ÷ days × 7" />
            <StatCard label="Daily floor" value={formatMoney(r.dailyMinor)} hint="One day of essentials" tone="cyan" />
            <StatCard
              label="Left after essentials"
              value={formatMoney(r.remainingAfterProjectedMinor)}
              hint="Projected income minus essentials"
              tone={r.remainingAfterProjectedMinor < 0 ? "danger" : r.remainingAfterProjectedMinor < r.monthlyEssentialMinor * 0.1 ? "warn" : "default"}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <h2 className="font-semibold">Where the essentials go</h2>
              <p className="text-xs text-navy/75">Monthly amounts you entered or accepted from location estimates.</p>
              {rows.length ? (
                <ul className="mt-3 grid gap-3">
                  {rows.map((row) => (
                    <li key={row.key}>
                      <div className="flex justify-between gap-2 text-sm">
                        <span>{BREAKDOWN_LABELS[row.key] || row.key}</span>
                        <span className="font-medium">{formatMoney(row.value)}</span>
                      </div>
                      <div className="mt-1">
                        <ProgressBar
                          value={Math.round((row.value / maxRow) * 100)}
                          tone={row.key === "housing" ? "navy" : "cyan"}
                          label={`${BREAKDOWN_LABELS[row.key] || row.key} share of essentials`}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-navy/70">No essentials recorded yet.</p>
              )}
              <p className="mt-3 text-xs text-navy/75">
                {r.estimatesUsed
                  ? "Some missing amounts used optional location estimates."
                  : "Only the amounts you entered were used."}
              </p>
            </Card>

            <Card>
              <h2 className="font-semibold">If the budget is tight</h2>
              {r.adjustments?.length ? (
                <ul className="mt-3 grid gap-2 text-sm">
                  {r.adjustments.map((item) => (
                    <li key={item} className="rounded-lg bg-powder p-3">
                      {item}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-navy/70">
                  No adjustment is flagged right now. Keep essentials protected first.
                </p>
              )}
            </Card>
          </div>
        </>
      ) : null}

      <Card>
        <h2 className="mb-4 font-semibold">Update essential costs</h2>
        <MoneyForm
          submitLabel="Update essentials"
          onSubmit={async (body) => {
            await api("/api/survival", { method: "PUT", body });
            await load();
          }}
          fields={[
            { name: "city", label: "City", type: "select", options: [["Karachi", "Karachi"], ["Lahore", "Lahore"], ["Islamabad", "Islamabad"], ["Other", "Other"]] },
            { name: "housing", label: "Housing (PKR / month)", type: "number", step: "0.01" },
            { name: "food", label: "Food (PKR / month)", type: "number", step: "0.01" },
            { name: "utilities", label: "Utilities (PKR / month)", type: "number", step: "0.01" },
            { name: "transport", label: "Transport (PKR / month)", type: "number", step: "0.01" },
            { name: "medical", label: "Medical (PKR / month)", type: "number", step: "0.01" },
            { name: "education", label: "Education (PKR / month)", type: "number", step: "0.01" },
            { name: "other", label: "Other essentials (PKR / month)", type: "number", step: "0.01" },
            { name: "useLocationEstimates", label: "Fill missing food/utilities/transport from city estimates", type: "checkbox" },
          ]}
        />
      </Card>

      {r ? (
        <Card>
          <h2 className="font-semibold">How this was calculated</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
            {r.explanations.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
