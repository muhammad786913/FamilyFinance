"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, Badge, Button, Card, Empty } from "@/components/ui";
import { MoneyForm } from "@/components/MoneyForm";
import { api, formatMoney } from "@/lib/format";

const LABELS = {
  comfortably_affordable: "Comfortably affordable",
  affordable_with_adjustments: "Affordable only with adjustments",
  currently_unaffordable: "Currently unaffordable",
};

const KINDS = [
  ["wedding", "Wedding"],
  ["dinner", "Family dinner"],
  ["eid", "Eid shopping"],
  ["guests", "Guests"],
  ["travel", "Travel"],
  ["appliance", "Appliance"],
  ["purchase", "Other purchase"],
  ["other", "Other"],
];

const FIELDS = [
  { name: "name", label: "Event or purchase", required: true },
  { name: "kind", label: "Type", type: "select", options: KINDS },
  { name: "amount", label: "Target amount (PKR)", type: "number", step: "0.01", required: true },
  { name: "targetDate", label: "Target date", type: "date", required: true },
];

export default function EventsPage() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    try {
      setItems((await api("/api/events?limit=100")).items);
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold">Special events</h1>
      <p className="text-sm text-navy/80">
        Affordability is simulated against this month’s plan. Your records are not changed until you add a bill yourself.
      </p>
      {error ? (
        <Alert title="Error" tone="danger">
          {error}
        </Alert>
      ) : null}
      <Card>
        <MoneyForm
          submitLabel="Add event"
          fields={FIELDS}
          onSubmit={async (body) => {
            await api("/api/events", { method: "POST", body });
            await load();
          }}
        />
      </Card>
      {!items.length ? <Empty title="No events">Plan a wedding, dinner, trip, or purchase.</Empty> : null}
      <ul className="grid gap-3">
        {items.map((ev) => (
          <li key={ev._id}>
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">{ev.name}</p>
                  <p className="text-sm">
                    {formatMoney(ev.amountMinor)} on {ev.targetDate}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{LABELS[ev.verdict] || ev.verdict}</Badge>
                  <Button
                    type="button"
                    variant="secondary"
                    aria-expanded={editing === ev._id}
                    onClick={() => setEditing(editing === ev._id ? null : ev._id)}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    onClick={async () => {
                      if (!window.confirm(`Delete event "${ev.name}"?`)) return;
                      await api(`/api/events/${ev._id}`, { method: "DELETE" });
                      await load();
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </div>
              {editing === ev._id ? (
                <div className="mt-4 rounded-lg border border-soft p-3">
                  <MoneyForm
                    key={`edit-${ev._id}`}
                    fields={FIELDS}
                    submitLabel="Save changes"
                    values={{
                      name: ev.name,
                      kind: ev.kind,
                      amount: ev.amountMinor / 100,
                      targetDate: ev.targetDate,
                    }}
                    onSubmit={async (body) => {
                      await api(`/api/events/${ev._id}`, { method: "PATCH", body });
                      setEditing(null);
                      await load();
                    }}
                  />
                </div>
              ) : null}
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
