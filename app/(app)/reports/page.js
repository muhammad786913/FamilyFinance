"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, Button, Card, Empty, Field, Input, Select } from "@/components/ui";
import { api, formatMoney } from "@/lib/format";

const CATEGORIES = [
  ["", "All categories"],
  ["rent_housing", "Rent and housing"],
  ["groceries", "Groceries"],
  ["electricity_gas_water", "Electricity, gas, water"],
  ["internet_phone", "Internet and phone"],
  ["education", "School and education"],
  ["transport", "Transport"],
  ["medical", "Medical"],
  ["debt", "Debt"],
  ["family_support", "Family support"],
  ["clothing", "Clothing"],
  ["entertainment", "Entertainment"],
  ["other", "Other"],
];

const EMPTY = { from: "", to: "", category: "" };

const label = (key) => CATEGORIES.find(([value]) => value === key)?.[1] || key;

export default function ReportsPage() {
  const [form, setForm] = useState(EMPTY);
  const [query, setQuery] = useState(EMPTY);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const qs = new URLSearchParams();
      for (const [key, value] of Object.entries(query)) if (value) qs.set(key, value);
      setData(await api(`/api/reports${qs.size ? `?${qs}` : ""}`));
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, [query]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = data ? Object.entries(data.byCategory || {}).sort((a, b) => b[1].planned - a[1].planned) : [];
  const max = Math.max(1, ...rows.flatMap(([, v]) => [v.planned, v.actual]));
  const width = (value) => `${Math.min(100, Math.round((value / max) * 100))}%`;

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold">Reports</h1>
      <p className="text-sm">Projected figures are labelled. Actual savings are amounts you recorded on the household.</p>
      <Card>
        <form
          className="grid gap-3 md:grid-cols-4 md:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            setQuery({ ...form });
          }}
        >
          <Field label="From" htmlFor="from">
            <Input id="from" name="from" type="date" value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} />
          </Field>
          <Field label="To" htmlFor="to">
            <Input id="to" name="to" type="date" value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} />
          </Field>
          <Field label="Category" htmlFor="category">
            <Select id="category" name="category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {CATEGORIES.map(([value, text]) => (
                <option key={value} value={value}>
                  {text}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex gap-2">
            <Button type="submit" disabled={busy}>
              {busy ? "Loading…" : "Apply"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setForm(EMPTY);
                setQuery(EMPTY);
              }}
            >
              Reset
            </Button>
          </div>
        </form>
        {data?.period ? (
          <p className="mt-3 text-sm text-navy/70" role="status">
            Showing {data.period.from} to {data.period.to}
            {query.category ? ` · ${label(query.category)}` : ""}
          </p>
        ) : null}
      </Card>
      {error ? (
        <Alert title="Report unavailable" tone="danger">
          {error}
        </Alert>
      ) : null}
      {data ? (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            {[
              ["Starting balance", data.startingBalanceMinor],
              ["Income received", data.confirmedIncomeMinor],
              ["Expected remaining income", data.expectedIncomeMinor],
              ["Actual spending", data.actualSpendMinor],
              ["Unpaid bills", data.unpaidBillsMinor],
              ["Projected ending balance", data.endingProjectedMinor],
              ["Actual savings recorded", data.actualSavingsMinor],
              ["Projected surplus after reserve", data.projectedSurplusMinor],
            ].map(([text, value]) => (
              <Card key={text}>
                <p className="text-sm">{text}</p>
                <p className="text-xl font-semibold">{formatMoney(value)}</p>
              </Card>
            ))}
          </div>
          <Card>
            <h2 className="font-semibold">Plan vs actual by category</h2>
            <p className="mt-1 text-sm text-navy/70">Planned is the bill amount; actual is what you recorded as paid.</p>
            {rows.length ? (
              <div className="mt-4 grid gap-4">
                {rows.map(([key, v]) => (
                  <div key={key}>
                    <div className="flex flex-wrap justify-between gap-2 text-sm">
                      <span className="font-medium">{label(key)}</span>
                      <span>
                        {formatMoney(v.planned)} planned · {formatMoney(v.actual)} actual
                      </span>
                    </div>
                    <div className="mt-2 grid gap-1" aria-hidden="true">
                      <div className="h-2 rounded bg-powder">
                        <div className="h-2 rounded bg-soft" style={{ width: width(v.planned) }} />
                      </div>
                      <div className="h-2 rounded bg-powder">
                        <div className="h-2 rounded bg-cyan" style={{ width: width(v.actual) }} />
                      </div>
                    </div>
                  </div>
                ))}
                <table className="mt-2 w-full text-left text-sm">
                  <caption className="sr-only">Category plan and actual amounts</caption>
                  <thead>
                    <tr>
                      <th className="p-1">Category</th>
                      <th className="p-1">Planned</th>
                      <th className="p-1">Actual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(([key, v]) => (
                      <tr key={key} className="border-t border-soft">
                        <td className="p-1">{label(key)}</td>
                        <td className="p-1">{formatMoney(v.planned)}</td>
                        <td className="p-1">{formatMoney(v.actual)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="mt-3">
                <Empty title="No expenses in this range">Choose a wider date range or add bills.</Empty>
              </div>
            )}
          </Card>
          <Card>
            <h2 className="font-semibold">Categories over planned amount</h2>
            {data.overCategories.length ? (
              <ul className="mt-3 text-sm">
                {data.overCategories.map((c) => (
                  <li key={c.category}>
                    {label(c.category)}: over by {formatMoney(c.overMinor)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm">No category has exceeded its planned amount in this range.</p>
            )}
          </Card>
        </>
      ) : busy ? (
        <p role="status">Loading report…</p>
      ) : null}
    </div>
  );
}
