"use client";

import { useState } from "react";
import { Button, Card, Field, Input } from "@/components/ui";
import { api } from "@/lib/format";

const STEPS = ["Household", "Location", "People", "Balances", "Done"];

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");

  async function save(body, complete) {
    try {
      await api("/api/household", { method: "PATCH", body: complete ? { ...body, setupComplete: true } : body });
      setError("");
      if (complete) window.location.href = "/dashboard";
      else setStep((s) => s + 1);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Card className="mx-auto max-w-lg">
      <p className="text-sm text-cyan">Step {step + 1} of {STEPS.length}</p>
      <h1 className="text-2xl font-semibold">{STEPS[step]}</h1>
      {step === 0 && (
        <form className="mt-4 grid gap-3" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); save({ name: f.get("name") }); }}>
          <Field label="Household name" htmlFor="name"><Input id="name" name="name" required /></Field>
          <Button type="submit">Continue</Button>
        </form>
      )}
      {step === 1 && (
        <form className="mt-4 grid gap-3" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); save({ country: f.get("country"), currency: f.get("currency"), city: f.get("city"), timezone: f.get("timezone") }); }}>
          <Field label="Country" htmlFor="country"><Input id="country" name="country" defaultValue="PK" /></Field>
          <Field label="Currency" htmlFor="currency"><Input id="currency" name="currency" defaultValue="PKR" /></Field>
          <Field label="City" htmlFor="city"><Input id="city" name="city" defaultValue="Karachi" /></Field>
          <Field label="Timezone" htmlFor="timezone"><Input id="timezone" name="timezone" defaultValue="Asia/Karachi" /></Field>
          <Button type="submit">Continue</Button>
        </form>
      )}
      {step === 2 && (
        <form className="mt-4 grid gap-3" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); save({ members: [{ label: f.get("member"), ageGroup: f.get("ageGroup") }] }); }}>
          <Field label="First member name or nickname" htmlFor="member"><Input id="member" name="member" /></Field>
          <Field label="Age group" htmlFor="ageGroup">
            <Input id="ageGroup" name="ageGroup" defaultValue="adult" />
          </Field>
          <Button type="submit">Continue</Button>
        </form>
      )}
      {step === 3 && (
        <form className="mt-4 grid gap-3" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); save({ startingBalance: f.get("startingBalance"), savingsBalance: f.get("savingsBalance"), emergencyReserve: f.get("emergencyReserve"), planningStartDay: f.get("planningStartDay") }); }}>
          <Field label="Starting balance (PKR)" htmlFor="startingBalance"><Input id="startingBalance" name="startingBalance" type="number" step="0.01" defaultValue="0" /></Field>
          <Field label="Existing savings (PKR)" htmlFor="savingsBalance"><Input id="savingsBalance" name="savingsBalance" type="number" step="0.01" defaultValue="0" /></Field>
          <Field label="Emergency reserve (PKR)" htmlFor="emergencyReserve"><Input id="emergencyReserve" name="emergencyReserve" type="number" step="0.01" defaultValue="0" /></Field>
          <Field label="Planning month start day" htmlFor="planningStartDay"><Input id="planningStartDay" name="planningStartDay" type="number" defaultValue="1" /></Field>
          <Button type="submit">Continue</Button>
        </form>
      )}
      {step === 4 && (
        <div className="mt-4 grid gap-3">
          <p>You can add income and bills next. Optional questions can stay empty.</p>
          <Button type="button" onClick={() => save({}, true)}>Finish setup</Button>
        </div>
      )}
      <button className="mt-4 text-sm text-cyan" type="button" onClick={() => save({ setupComplete: true }, true)}>
        Skip remaining questions
      </button>
      {error ? <p className="mt-2 text-sm text-[#8B3A3A]">{error}</p> : null}
    </Card>
  );
}
