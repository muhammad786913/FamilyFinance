"use client";

import { useEffect, useState } from "react";
import { Alert, Button, Card } from "@/components/ui";
import { MoneyForm } from "@/components/MoneyForm";
import { api } from "@/lib/format";

export default function SettingsPage() {
  const [data, setData] = useState(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    api("/api/household").then(setData);
  }, []);

  if (!data) return <p>Loading settings…</p>;
  const h = data.household;

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold">Settings</h1>
      <Card>
        <MoneyForm
          submitLabel="Save household"
          onSubmit={async (body) => {
            setData(await api("/api/household", { method: "PATCH", body }));
            setMessage("Saved.");
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
      <Card className="flex flex-wrap gap-3">
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
      </Card>
    </div>
  );
}
