"use client";

import { useEffect, useState } from "react";
import { api, formatMoney } from "@/lib/format";
import { Alert, Badge, Button, Card, Empty } from "./ui";
import { MoneyForm } from "./MoneyForm";

export function Records({ title, endpoint, fields, submitLabel, renderMeta, payField }) {
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const data = await api(endpoint);
      setItems(data.items || []);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [endpoint]);

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <Card>
        <h2 className="mb-4 text-lg font-semibold">Add</h2>
        <MoneyForm
          fields={fields}
          submitLabel={submitLabel}
          onSubmit={async (body) => {
            await api(endpoint, { method: "POST", body });
            await load();
          }}
        />
      </Card>
      {error ? <Alert title="Could not load records" tone="danger">{error}</Alert> : null}
      {loading ? <p>Loading…</p> : null}
      {!loading && !items.length ? <Empty title="Nothing here yet">Add your first record to start planning.</Empty> : null}
      <ul className="grid gap-3">
        {items.map((item) => (
          <li key={item._id}>
            <Card className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{item.name}</p>
                <p className="text-sm text-navy/80">{renderMeta(item)}</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  <Badge>{item.status}</Badge>
                  <Badge>{item.frequency}</Badge>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {payField ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={async () => {
                      const value = window.prompt("Amount received/paid (major units)");
                      if (!value) return;
                      await api(`${endpoint}/${item._id}`, { method: "PATCH", body: { [payField]: value } });
                      await load();
                    }}
                  >
                    Record payment
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="danger"
                  onClick={async () => {
                    if (!window.confirm("Delete this record? History of this item will be removed.")) return;
                    await api(`${endpoint}/${item._id}`, { method: "DELETE" });
                    await load();
                  }}
                >
                  Delete
                </Button>
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function moneyLabel(item, plannedKey, actualKey, currency) {
  return `${formatMoney(item[plannedKey], currency)} planned · ${formatMoney(item[actualKey], currency)} actual`;
}
