"use client";

import { useEffect, useState } from "react";
import { Alert, Badge, Card, Empty } from "@/components/ui";
import { MoneyForm } from "@/components/MoneyForm";
import { api, formatMoney } from "@/lib/format";

const labels = {
  comfortably_affordable: "Comfortably affordable",
  affordable_with_adjustments: "Affordable only with adjustments",
  currently_unaffordable: "Currently unaffordable",
};

export default function EventsPage() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");

  async function load() {
    try {
      setItems((await api("/api/events")).items);
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold">Special events</h1>
      <p className="text-sm text-navy/80">Affordability is simulated against this month’s plan. Your records are not changed until you add a bill yourself.</p>
      {error ? <Alert title="Error" tone="danger">{error}</Alert> : null}
      <Card>
        <MoneyForm
          submitLabel="Add event"
          onSubmit={async (body) => {
            await api("/api/events", { method: "POST", body });
            await load();
          }}
          fields={[
            { name: "name", label: "Event or purchase", required: true },
            {
              name: "kind",
              label: "Type",
              type: "select",
              options: [
                ["wedding", "Wedding"],
                ["dinner", "Family dinner"],
                ["eid", "Eid shopping"],
                ["guests", "Guests"],
                ["travel", "Travel"],
                ["appliance", "Appliance"],
                ["purchase", "Other purchase"],
                ["other", "Other"],
              ],
            },
            { name: "amount", label: "Target amount (PKR)", type: "number", step: "0.01", required: true },
            { name: "targetDate", label: "Target date", type: "date", required: true },
          ]}
        />
      </Card>
      {!items.length ? <Empty title="No events">Plan a wedding, dinner, trip, or purchase.</Empty> : null}
      <ul className="grid gap-3">
        {items.map((ev) => (
          <li key={ev._id}>
            <Card className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold">{ev.name}</p>
                <p className="text-sm">
                  {formatMoney(ev.amountMinor)} on {ev.targetDate}
                </p>
              </div>
              <Badge>{labels[ev.verdict] || ev.verdict}</Badge>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
