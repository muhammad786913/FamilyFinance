"use client";

import { useEffect, useState } from "react";
import { Alert, Button, Card, PageHeader, StatCard } from "@/components/ui";
import { MoneyForm } from "@/components/MoneyForm";
import { api, formatMoney } from "@/lib/format";

export default function SettingsPage() {
  const [data, setData] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api("/api/household")
      .then(setData)
      .catch((err) => setError(err.message));
  }, []);

  if (error) {
    return (
      <Alert title="Settings unavailable" tone="danger">
        {error}
      </Alert>
    );
  }
  if (!data) return <p role="status">Loading settings…</p>;
  const h = data.household;

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Household profile"
        title="Settings"
        description="These values anchor every projection. Change the planning start day if your household budgets from a date other than the 1st."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Starting balance" value={formatMoney(h.startingBalanceMinor)} hint="Cash at the start of a cycle" />
        <StatCard label="Recorded savings" value={formatMoney(h.savingsBalanceMinor)} hint="Actual amount set aside" tone="cyan" />
        <StatCard label="Emergency reserve" value={formatMoney(h.emergencyReserveMinor)} hint="Protected before suggested spending" />
        <StatCard
          label="Planning cycle starts"
          value={`Day ${h.planningStartDay}`}
          hint={`${h.currency} · ${h.timezone || "Asia/Karachi"}`}
        />
      </div>

      <Card>
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold">Household details</h2>
          <span className="text-xs text-navy/75">{h.name} · {h.city || "City not set"}</span>
        </div>
        <MoneyForm
          submitLabel="Save household"
          onSubmit={async (body) => {
            try {
              setData(await api("/api/household", { method: "PATCH", body }));
              setMessage("Saved.");
            } catch (err) {
              throw err;
            }
          }}
          fields={[
            { name: "name", label: "Household name", defaultValue: h.name, required: true },
            { name: "country", label: "Country", defaultValue: h.country },
            { name: "currency", label: "Currency", defaultValue: h.currency },
            { name: "locale", label: "Locale", defaultValue: h.locale },
            { name: "timezone", label: "Timezone", defaultValue: h.timezone },
            { name: "city", label: "City", defaultValue: h.city },
            { name: "planningStartDay", label: "Month planning start day (1–28)", type: "number", defaultValue: h.planningStartDay },
            { name: "weekStartsOn", label: "Week starts on (0=Sun, 1=Mon)", type: "number", defaultValue: h.weekStartsOn },
            { name: "startingBalance", label: "Starting balance (PKR)", type: "number", step: "0.01", defaultValue: (h.startingBalanceMinor || 0) / 100 },
            { name: "savingsBalance", label: "Recorded savings (PKR)", type: "number", step: "0.01", defaultValue: (h.savingsBalanceMinor || 0) / 100 },
            { name: "emergencyReserve", label: "Emergency reserve (PKR)", type: "number", step: "0.01", defaultValue: (h.emergencyReserveMinor || 0) / 100 },
          ]}
        />
      </Card>

      {message ? <Alert title="Settings">{message}</Alert> : null}

      <Card>
        <h2 className="font-semibold">Your data</h2>
        <p className="mt-1 text-sm text-navy/70">
          Export a JSON copy at any time. Deleting the household removes its income, bills, goals, events, and scenarios.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={async () => {
              const payload = await api("/api/household/export");
              const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "familyfinance-export.json";
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            Export data
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={async () => {
              if (!window.confirm("Delete this household and all financial records? This cannot be undone.")) return;
              await api("/api/household", { method: "DELETE" });
              window.location.href = "/signup";
            }}
          >
            Delete household
          </Button>
        </div>
      </Card>
    </div>
  );
}
