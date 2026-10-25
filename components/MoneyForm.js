"use client";

import { useState } from "react";
import { Button, Field, Input, Select } from "./ui";
import { api } from "@/lib/format";

export function MoneyForm({ fields, submitLabel, onSubmit, extra }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const body = Object.fromEntries(form.entries());
    for (const key of ["essential", "estimated", "apply", "useLocationEstimates", "extraEssential"]) {
      body[key] = form.get(key) === "on";
    }
    try {
      await onSubmit(body);
      event.currentTarget.reset();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="grid gap-3 md:grid-cols-2" onSubmit={handleSubmit}>
      {fields.map((f) => (
        <Field key={f.name} label={f.label} htmlFor={f.name}>
          {f.type === "select" ? (
            <Select id={f.name} name={f.name} defaultValue={f.defaultValue} required={f.required}>
              {f.options.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          ) : f.type === "checkbox" ? (
            <input id={f.name} name={f.name} type="checkbox" defaultChecked={f.defaultChecked} className="h-5 w-5 accent-cyan" />
          ) : (
            <Input id={f.name} name={f.name} type={f.type || "text"} required={f.required} defaultValue={f.defaultValue} step={f.step} />
          )}
        </Field>
      ))}
      {extra}
      {error ? (
        <p className="md:col-span-2 text-sm text-[#8B3A3A]" role="alert">
          {error}
        </p>
      ) : null}
      <div className="md:col-span-2">
        <Button disabled={busy} type="submit">
          {busy ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}

export { api };
