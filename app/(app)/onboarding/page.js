"use client";

import { useState } from "react";
import { Button, Card, Field, Input, Select } from "@/components/ui";
import { api } from "@/lib/format";

const STEPS = ["Household", "Location", "People", "Balances", "Done"];

const AGE_GROUPS = [
  ["adult", "Adult"],
  ["child", "Child"],
  ["teen", "Teen"],
  ["senior", "Senior"],
  ["unspecified", "Prefer not to say"],
];

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [members, setMembers] = useState([]);
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
      <p className="text-sm text-cyan">
        Step {step + 1} of {STEPS.length}
      </p>
      <h1 className="text-2xl font-semibold">{STEPS[step]}</h1>
      {step === 0 && (
        <form
          className="mt-4 grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            save({ name: f.get("name") });
          }}
        >
          <Field label="Household name" htmlFor="name">
            <Input id="name" name="name" required />
          </Field>
          <Button type="submit">Continue</Button>
        </form>
      )}
      {step === 1 && (
        <form
          className="mt-4 grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            save({ country: f.get("country"), currency: f.get("currency"), city: f.get("city"), timezone: f.get("timezone") });
          }}
        >
          <Field label="Country" htmlFor="country">
            <Input id="country" name="country" defaultValue="PK" />
          </Field>
          <Field label="Currency" htmlFor="currency">
            <Input id="currency" name="currency" defaultValue="PKR" />
          </Field>
          <Field label="City" htmlFor="city">
            <Input id="city" name="city" defaultValue="Karachi" />
          </Field>
          <Field label="Timezone" htmlFor="timezone">
            <Input id="timezone" name="timezone" defaultValue="Asia/Karachi" />
          </Field>
          <Button type="submit">Continue</Button>
        </form>
      )}
      {step === 2 && (
        <div className="mt-4 grid gap-3">
          <p className="text-sm text-navy/80">Add everyone the budget should cover. You can change this later in Settings.</p>
          {members.length ? (
            <ul className="grid gap-2">
              {members.map((m, i) => (
                <li key={`${m.label}-${i}`} className="flex items-center justify-between rounded-lg bg-powder px-3 py-2 text-sm">
                  <span>{m.label}</span>
                  <button
                    type="button"
                    className="text-sm font-semibold text-[#8B3A3A]"
                    onClick={() => setMembers(members.filter((_, index) => index !== i))}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <form
            className="grid gap-3 rounded-lg border border-soft p-3"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const label = String(f.get("member") || "").trim();
              if (!label) return;
              setMembers([...members, { label, ageGroup: f.get("ageGroup") }]);
              e.currentTarget.reset();
            }}
          >
            <Field label="Member name or nickname" htmlFor="member">
              <Input id="member" name="member" maxLength={40} />
            </Field>
            <Field label="Age group" htmlFor="ageGroup">
              <Select id="ageGroup" name="ageGroup" defaultValue="adult">
                {AGE_GROUPS.map(([value, text]) => (
                  <option key={value} value={value}>
                    {text}
                  </option>
                ))}
              </Select>
            </Field>
            <Button type="submit" variant="secondary">
              Add member
            </Button>
          </form>
          <Button type="button" onClick={() => save({ members })}>
            Continue
          </Button>
        </div>
      )}
      {step === 3 && (
        <form
          className="mt-4 grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            save({
              startingBalance: f.get("startingBalance"),
              savingsBalance: f.get("savingsBalance"),
              emergencyReserve: f.get("emergencyReserve"),
              planningStartDay: f.get("planningStartDay"),
            });
          }}
        >
          <Field label="Starting balance (PKR)" htmlFor="startingBalance">
            <Input id="startingBalance" name="startingBalance" type="number" step="0.01" defaultValue="0" />
          </Field>
          <Field label="Existing savings (PKR)" htmlFor="savingsBalance">
            <Input id="savingsBalance" name="savingsBalance" type="number" step="0.01" defaultValue="0" />
          </Field>
          <Field label="Emergency reserve (PKR)" htmlFor="emergencyReserve">
            <Input id="emergencyReserve" name="emergencyReserve" type="number" step="0.01" defaultValue="0" />
          </Field>
          <Field label="Planning month start day (1–28)" htmlFor="planningStartDay">
            <Input id="planningStartDay" name="planningStartDay" type="number" min="1" max="28" defaultValue="1" />
          </Field>
          <Button type="submit">Continue</Button>
        </form>
      )}
      {step === 4 && (
        <div className="mt-4 grid gap-3">
          <p>Next, add your income dates and essential bills. Goals and events are optional.</p>
          <Button type="button" onClick={() => save({}, true)}>
            Finish setup
          </Button>
        </div>
      )}
      <button className="mt-4 text-sm text-cyan" type="button" onClick={() => save({ setupComplete: true }, true)}>
        Skip remaining questions
      </button>
      {error ? (
        <p className="mt-2 text-sm text-[#8B3A3A]" role="alert">
          {error}
        </p>
      ) : null}
    </Card>
  );
}
