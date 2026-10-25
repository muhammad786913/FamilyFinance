"use client";

import { useEffect, useState } from "react";
import { Alert, Card } from "@/components/ui";
import { MoneyForm } from "@/components/MoneyForm";
import { api, formatMoney } from "@/lib/format";

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

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold">Minimum survival budget</h1>
      <p className="text-sm">This uses your household size, location, and essential costs. It is not a poverty-line test and does not label a household as unable to survive.</p>
      {error ? <Alert title="Error" tone="danger">{error}</Alert> : null}
      {r ? (
        <Alert title={r.headline} tone={r.status === "exceeds" ? "danger" : r.status === "tight" ? "warn" : "info"}>
          Monthly essentials {formatMoney(r.monthlyEssentialMinor)} · weekly {formatMoney(r.weeklyMinor)} · daily {formatMoney(r.dailyMinor)}
        </Alert>
      ) : null}
      <Card>
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
