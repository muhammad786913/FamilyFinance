"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/format";
import { Alert, Badge, Button, Card, Empty, Field, Input, Select } from "./ui";
import { MoneyForm } from "./MoneyForm";

const PAGE_SIZE = 10;

function todayYmd() {
  return new Date().toLocaleDateString("en-CA");
}

function PaymentForm({ endpoint, item, payField, onDone, onCancel }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const dateField = payField === "receive" ? "receivedDate" : "paidDate";

  async function submit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      await api(`${endpoint}/${item._id}`, {
        method: "PATCH",
        body: {
          [payField]: form.get("amount"),
          [dateField]: form.get("date"),
          note: form.get("note"),
        },
      });
      await onDone();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <form className="mt-3 grid gap-3 rounded-lg bg-powder p-3 md:grid-cols-3" onSubmit={submit}>
      <Field label="Amount (PKR)" htmlFor={`pay-${item._id}`}>
        <Input id={`pay-${item._id}`} name="amount" type="number" step="0.01" min="0.01" required />
      </Field>
      <Field label="Date" htmlFor={`date-${item._id}`}>
        <Input id={`date-${item._id}`} name="date" type="date" defaultValue={todayYmd()} required />
      </Field>
      <Field label="Note (optional)" htmlFor={`note-${item._id}`}>
        <Input id={`note-${item._id}`} name="note" maxLength={120} />
      </Field>
      {error ? (
        <p className="text-sm text-[#8B3A3A] md:col-span-3" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2 md:col-span-3">
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save payment"}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function Records({ title, endpoint, fields, submitLabel, renderMeta, payField, filters = [], editValues }) {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [active, setActive] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);
  const [paying, setPaying] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      for (const [key, value] of Object.entries(active)) if (value) qs.set(key, value);
      const data = await api(`${endpoint}?${qs}`);
      setItems(data.items || []);
      setTotal(data.total || 0);
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [endpoint, page, active]);

  useEffect(() => {
    load();
  }, [load]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function setFilter(name, value) {
    setPaying(null);
    setEditing(null);
    setPage(1);
    setActive((prev) => ({ ...prev, [name]: value }));
  }

  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <div className="flex flex-wrap gap-2">
        <a
          className="inline-flex min-h-11 items-center rounded-lg border border-soft bg-white px-4 text-sm font-semibold text-navy hover:bg-powder"
          href={`/api/export/csv?type=${payField === "pay" ? "expenses" : "income"}`}
          download
        >
          Download CSV
        </a>
      </div>
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
      {filters.length ? (
        <Card>
          <div className="grid gap-3 md:grid-cols-3">
            {filters.map((f) => (
              <Field key={f.name} label={f.label} htmlFor={`filter-${f.name}`}>
                <Select
                  id={`filter-${f.name}`}
                  value={active[f.name] || ""}
                  onChange={(event) => setFilter(f.name, event.target.value)}
                >
                  {f.options.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </Select>
              </Field>
            ))}
          </div>
          <p className="mt-3 text-sm text-navy/70" role="status">
            {total} record{total === 1 ? "" : "s"} found
          </p>
        </Card>
      ) : null}
      {error ? (
        <Alert title="Could not load records" tone="danger">
          {error}
        </Alert>
      ) : null}
      {loading ? <p role="status">Loading…</p> : null}
      {!loading && !items.length ? (
        <Empty title="Nothing here yet">Add your first record to start planning.</Empty>
      ) : null}
      <ul className="grid gap-3">
        {items.map((item) => (
          <li key={item._id}>
            <Card>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{item.name}</p>
                  <p className="text-sm text-navy/80">{renderMeta(item)}</p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <Badge>{item.status}</Badge>
                    {item.scheduleId ? <Badge>repeating</Badge> : <Badge>{item.frequency}</Badge>}
                    {item.essential === false ? <Badge>optional</Badge> : null}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {editValues ? (
                    <Button
                      type="button"
                      variant="secondary"
                      aria-expanded={editing === item._id}
                      onClick={() => {
                        setPaying(null);
                        setEditing(editing === item._id ? null : item._id);
                      }}
                    >
                      Edit
                    </Button>
                  ) : null}
                  {payField ? (
                    <Button
                      type="button"
                      variant="secondary"
                      aria-expanded={paying === item._id}
                      onClick={() => {
                        setEditing(null);
                        setPaying(paying === item._id ? null : item._id);
                      }}
                    >
                      Record payment
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="danger"
                    onClick={async () => {
                      const message = item.scheduleId
                        ? "Delete this repeating item? This removes the schedule and future unpaid entries. Paid history is kept."
                        : "Delete this record? Its payment history will be removed.";
                      if (!window.confirm(message)) return;
                      await api(`${endpoint}/${item._id}`, { method: "DELETE" });
                      await load();
                    }}
                  >
                    {item.scheduleId ? "Delete repeating" : "Delete"}
                  </Button>
                </div>
              </div>
              {editing === item._id ? (
                <div className="mt-4 rounded-lg border border-soft p-3">
                  {item.scheduleId ? (
                    <p className="mb-3 text-xs text-navy/70">
                      This entry belongs to a repeating schedule. Changing the name, amount, or category also updates future
                      repeats. The frequency is fixed; delete the repeating item to stop it.
                    </p>
                  ) : null}
                  <MoneyForm
                    key={`edit-${item._id}`}
                    fields={item.scheduleId ? fields.filter((field) => field.name !== "frequency") : fields}
                    values={editValues(item)}
                    submitLabel="Save changes"
                    onSubmit={async (body) => {
                      await api(`${endpoint}/${item._id}`, { method: "PATCH", body });
                      setEditing(null);
                      await load();
                    }}
                  />
                </div>
              ) : null}
              {paying === item._id ? (
                <PaymentForm
                  endpoint={endpoint}
                  item={item}
                  payField={payField}
                  onCancel={() => setPaying(null)}
                  onDone={async () => {
                    setPaying(null);
                    await load();
                  }}
                />
              ) : null}
            </Card>
          </li>
        ))}
      </ul>
      {pages > 1 ? (
        <nav className="flex items-center justify-between gap-3" aria-label="Pagination">
          <Button type="button" variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Previous
          </Button>
          <p className="text-sm" role="status">
            Page {page} of {pages}
          </p>
          <Button type="button" variant="secondary" disabled={page >= pages} onClick={() => setPage(page + 1)}>
            Next
          </Button>
        </nav>
      ) : null}
    </div>
  );
}
