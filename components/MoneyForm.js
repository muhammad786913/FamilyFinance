"use client";

import { useState } from "react";
import { Button, Field, Input, Select } from "./ui";
import { api } from "@/lib/format";
import formPayloadModule from "@/lib/formPayload";
import moneyModule from "@/lib/money";

const { formPayload } = formPayloadModule;
const { MAX_INPUT_MAJOR } = moneyModule;

export function MoneyForm({ fields, submitLabel, onSubmit, extra, values }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const value = (field) => (values && field.name in values ? values[field.name] : field.defaultValue);

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    const body = formPayload(form, fields);
    try {
      await onSubmit(body);
      // React clears `currentTarget` once the event dispatch finishes, so keep
      // the element itself instead of reading event.currentTarget after await.
      formEl.reset();
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
            <Select id={f.name} name={f.name} defaultValue={value(f)} required={f.required}>
              {f.options.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          ) : f.type === "checkbox" ? (
            <input
              id={f.name}
              name={f.name}
              type="checkbox"
              defaultChecked={values ? !!values[f.name] : f.defaultChecked}
              className="h-5 w-5 accent-cyan"
            />
          ) : (
            <Input
              id={f.name}
              name={f.name}
              type={f.type || "text"}
              required={f.required}
              defaultValue={value(f)}
              step={f.step}
              min={f.step ? 0 : undefined}
              max={f.step ? MAX_INPUT_MAJOR : undefined}
              inputMode={f.type === "number" ? "decimal" : undefined}
            />
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
