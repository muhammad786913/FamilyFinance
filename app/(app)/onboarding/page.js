"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Card, Field, Input, Select } from "@/components/ui";
import { api, formatMoney } from "@/lib/format";
import { monthlyPreview } from "@/lib/onboardingPlan";

const STEPS = [
  { title: "Welcome", hint: "Two quick things and we will build your month." },
  { title: "Money in", hint: "What comes in, and when?" },
  { title: "Essentials", hint: "Only the bills you want to plan for." },
  { title: "Debt", hint: "Skip this if nothing is owed." },
  { title: "Savings", hint: "One goal is enough to start." },
  { title: "Review", hint: "Check the month before confirming." },
];

const BILL_FIELDS = [
  { key: "rent", label: "Rent or housing", category: "rent_housing", priority: 1 },
  { key: "groceries", label: "Groceries", category: "groceries", priority: 1 },
  { key: "utilities", label: "Electricity, gas, water", category: "electricity_gas_water", priority: 2 },
  { key: "transport", label: "Transport and fuel", category: "transport", priority: 3 },
  { key: "education", label: "School fees", category: "education", priority: 2, childrenOnly: true },
];

function isoToday() {
  return new Date().toLocaleDateString("en-CA");
}

function isoInOneYear() {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toLocaleDateString("en-CA");
}

function nextDue(day) {
  const wanted = Math.min(28, Math.max(1, Number(day) || 1));
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const thisMonth = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(wanted)}`;
  if (thisMonth >= isoToday()) return thisMonth;
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(wanted)}`;
}

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState({
    name: "",
    adults: "1",
    children: "0",
    cash: "",
    income: "",
    frequency: "monthly",
    payday: isoToday(),
    dueDay: "5",
    bills: { rent: "", groceries: "", utilities: "", transport: "", education: "" },
    hasDebt: null,
    debt: "",
    debtDay: "5",
    hasGoal: null,
    goalName: "",
    goalTarget: "",
    goalMonthly: "",
    goalDate: isoInOneYear(),
  });
  const created = useRef({ income: false, bills: new Set(), debt: false, goal: false });

  useEffect(() => {
    let alive = true;
    api("/api/household")
      .then((res) => {
        if (!alive) return;
        if (res.household?.setupComplete) {
          window.location.replace("/dashboard");
          return;
        }
        const members = res.household?.members || [];
        setData((prev) => ({
          ...prev,
          name: res.household?.name || prev.name,
          adults: String(Math.max(1, members.filter((m) => m.ageGroup !== "child" && m.ageGroup !== "teen").length || 1)),
          children: String(members.filter((m) => m.ageGroup === "child" || m.ageGroup === "teen").length),
        }));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const patch = (part) => setData((prev) => ({ ...prev, ...part }));
  const billValues = BILL_FIELDS.map((f) =>
    f.childrenOnly && Number(data.children) <= 0 ? 0 : data.bills[f.key]
  );
  const preview = monthlyPreview({
    income: data.income,
    frequency: data.frequency,
    bills: billValues,
    debt: data.hasDebt ? data.debt : 0,
    goal: data.hasGoal ? data.goalMonthly : 0,
  });

  function validate() {
    if (step === 5 && String(data.cash).trim() !== "") {
      const cash = Number(data.cash);
      const cashMinor = Math.round(cash * 100);
      if (!Number.isFinite(cash) || cash < 0 || !Number.isSafeInteger(cashMinor)) {
        return "Enter a valid cash amount within the supported limit.";
      }
    }
    if (step === 0 && !String(data.name).trim()) return "Give your household a name (or keep the suggested one).";
    if (step === 1 && Number(data.income) > 0 && !data.payday) return "Choose the next payday.";
    if (step === 3 && data.hasDebt && !(Number(data.debt) > 0)) return "Enter the monthly debt instalment, or choose No debt.";
    if (step === 4 && data.hasGoal) {
      if (!String(data.goalName).trim()) return "Name the goal you are saving for.";
      if (!(Number(data.goalTarget) > 0)) return "Enter the amount you want to reach.";
      if (!data.goalDate) return "Pick a target date.";
    }
    return "";
  }

  function next() {
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setError("");
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }

  function back() {
    setError("");
    setStep((s) => Math.max(0, s - 1));
  }

  async function finish() {
    const cashProblem = validate();
    if (cashProblem) {
      setError(cashProblem);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const adults = Math.max(1, Math.min(20, Number(data.adults) || 1));
      const children = Math.max(0, Math.min(20, Number(data.children) || 0));
      const members = [
        ...Array.from({ length: adults }, (_, i) => ({ label: `Adult ${i + 1}`, ageGroup: "adult" })),
        ...Array.from({ length: children }, (_, i) => ({ label: `Child ${i + 1}`, ageGroup: "child" })),
      ];
      await api("/api/household", {
        method: "PATCH",
        body: { name: String(data.name).trim().slice(0, 80), members },
      });

      if (!created.current.income && Number(data.income) > 0) {
        await api("/api/income", {
          method: "POST",
          body: {
            name: "Main income",
            amount: data.income,
            expectedDate: data.payday,
            category: data.frequency === "weekly" ? "weekly_wage" : "salary",
            frequency: data.frequency,
            estimated: true,
            notes: "Added during onboarding",
          },
        });
        created.current.income = true;
      }

      for (const field of BILL_FIELDS) {
        if (field.childrenOnly && children <= 0) continue;
        if (created.current.bills.has(field.key)) continue;
        const value = Number(data.bills[field.key]);
        if (!(value > 0)) continue;
        await api("/api/expenses", {
          method: "POST",
          body: {
            name: field.label,
            category: field.category,
            amount: value,
            dueDate: nextDue(data.dueDay),
            frequency: "monthly",
            essential: true,
            priority: field.priority,
            notes: "Added during onboarding",
          },
        });
        created.current.bills.add(field.key);
      }

      if (data.hasDebt && Number(data.debt) > 0 && !created.current.debt) {
        await api("/api/expenses", {
          method: "POST",
          body: {
            name: "Debt instalment",
            category: "debt",
            amount: data.debt,
            dueDate: nextDue(data.debtDay),
            frequency: "monthly",
            essential: true,
            priority: 2,
            notes: "Added during onboarding",
          },
        });
        created.current.debt = true;
      }

      if (data.hasGoal && !created.current.goal) {
        await api("/api/goals", {
          method: "POST",
          body: {
            name: String(data.goalName).trim(),
            target: data.goalTarget,
            contribution: data.goalMonthly || 0,
            targetDate: data.goalDate,
            priority: 3,
          },
        });
        created.current.goal = true;
      }

      await api("/api/household", {
        method: "PATCH",
        body: { startingBalance: data.cash || 0, setupComplete: true },
      });
      window.location.href = "/dashboard";
    } catch (err) {
      setError(`${err.message} Nothing was lost — press Confirm again and completed items are skipped.`);
    } finally {
      setBusy(false);
    }
  }

  const money = (minor) => formatMoney(minor);

  return (
    <Card className="mx-auto max-w-xl">
      <div className="flex items-center justify-between gap-3 text-sm">
        <p className="font-semibold text-cyan">{STEPS[step].title}</p>
        <p className="text-navy/60">
          {step + 1} / {STEPS.length}
        </p>
      </div>
      <div className="mt-2 h-2 rounded bg-powder" aria-hidden="true">
        <div className="h-2 rounded bg-cyan transition-all" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
      </div>
      <h1 className="mt-4 text-2xl font-semibold">{STEPS[step].hint}</h1>

      {step === 0 && (
        <div className="mt-4 grid gap-4">
          <Field label="What should we call this household?" htmlFor="name" hint="We created this from your signup — rename it if you like.">
            <Input id="name" value={data.name} onChange={(e) => patch({ name: e.target.value })} maxLength={80} required />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Adults" htmlFor="adults">
              <Input id="adults" type="number" min="1" max="20" value={data.adults} onChange={(e) => patch({ adults: e.target.value })} />
            </Field>
            <Field label="Children" htmlFor="children" hint="Used to decide whether to ask about school fees.">
              <Input id="children" type="number" min="0" max="20" value={data.children} onChange={(e) => patch({ children: e.target.value })} />
            </Field>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="mt-4 grid gap-4">
          <Field label="Main monthly income (PKR)" htmlFor="income" hint="Take-home pay, or your average if it changes.">
            <Input id="income" type="number" min="0" step="0.01" value={data.income} onChange={(e) => patch({ income: e.target.value })} autoFocus />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="How often?" htmlFor="frequency">
              <Select id="frequency" value={data.frequency} onChange={(e) => patch({ frequency: e.target.value })}>
                <option value="monthly">Once a month</option>
                <option value="weekly">Every week</option>
                <option value="daily">Every day</option>
              </Select>
            </Field>
            <Field label="Next payday" htmlFor="payday">
              <Input id="payday" type="date" value={data.payday} onChange={(e) => patch({ payday: e.target.value })} />
            </Field>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="mt-4 grid gap-4">
          <p className="text-sm text-navy/70">Leave anything blank to skip it. Enter monthly amounts.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {BILL_FIELDS.map((field) => {
              if (field.childrenOnly && Number(data.children) <= 0) return null;
              return (
                <Field key={field.key} label={`${field.label} (PKR)`} htmlFor={`bill-${field.key}`}>
                  <Input
                    id={`bill-${field.key}`}
                    type="number"
                    min="0"
                    step="0.01"
                    value={data.bills[field.key]}
                    onChange={(e) => patch({ bills: { ...data.bills, [field.key]: e.target.value } })}
                  />
                </Field>
              );
            })}
          </div>
          <Field label="Usual due day" htmlFor="dueDay" hint="Used for the first month; each bill repeats monthly.">
            <Input id="dueDay" type="number" min="1" max="28" value={data.dueDay} onChange={(e) => patch({ dueDay: e.target.value })} />
          </Field>
        </div>
      )}

      {step === 3 && (
        <div className="mt-4 grid gap-4">
          <div className="flex gap-2">
            <Button type="button" variant={data.hasDebt === true ? "primary" : "secondary"} onClick={() => patch({ hasDebt: true })}>
              Yes, I have debt
            </Button>
            <Button type="button" variant={data.hasDebt === false ? "primary" : "secondary"} onClick={() => patch({ hasDebt: false })}>
              No debt
            </Button>
          </div>
          {data.hasDebt ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Monthly instalment (PKR)" htmlFor="debt">
                <Input id="debt" type="number" min="0" step="0.01" value={data.debt} onChange={(e) => patch({ debt: e.target.value })} />
              </Field>
              <Field label="Due day" htmlFor="debtDay">
                <Input id="debtDay" type="number" min="1" max="28" value={data.debtDay} onChange={(e) => patch({ debtDay: e.target.value })} />
              </Field>
            </div>
          ) : null}
        </div>
      )}

      {step === 4 && (
        <div className="mt-4 grid gap-4">
          <div className="flex gap-2">
            <Button type="button" variant={data.hasGoal === true ? "primary" : "secondary"} onClick={() => patch({ hasGoal: true })}>
              Yes, one goal
            </Button>
            <Button type="button" variant={data.hasGoal === false ? "primary" : "secondary"} onClick={() => patch({ hasGoal: false })}>
              Not right now
            </Button>
          </div>
          {data.hasGoal ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="What are you saving for?" htmlFor="goalName">
                <Input id="goalName" value={data.goalName} maxLength={120} onChange={(e) => patch({ goalName: e.target.value })} />
              </Field>
              <Field label="Target amount (PKR)" htmlFor="goalTarget">
                <Input id="goalTarget" type="number" min="0" step="0.01" value={data.goalTarget} onChange={(e) => patch({ goalTarget: e.target.value })} />
              </Field>
              <Field label="Monthly saving (PKR)" htmlFor="goalMonthly" hint="Optional — we will show it in the plan.">
                <Input id="goalMonthly" type="number" min="0" step="0.01" value={data.goalMonthly} onChange={(e) => patch({ goalMonthly: e.target.value })} />
              </Field>
              <Field label="Target date" htmlFor="goalDate">
                <Input id="goalDate" type="date" value={data.goalDate} onChange={(e) => patch({ goalDate: e.target.value })} />
              </Field>
            </div>
          ) : null}
        </div>
      )}

      {step === 5 && (
        <div className="mt-4 grid gap-4">
          <div className="grid gap-2 rounded-lg bg-powder p-4 text-sm">
            <div className="flex justify-between"><span>Monthly money in</span><strong>{money(preview.incomeMinor)}</strong></div>
            <div className="flex justify-between"><span>Bills and essentials</span><strong>{money(preview.billsMinor)}</strong></div>
            {preview.debtMinor ? <div className="flex justify-between"><span>Debt instalment</span><strong>{money(preview.debtMinor)}</strong></div> : null}
            {preview.savingsMinor ? <div className="flex justify-between"><span>Savings goal</span><strong>{money(preview.savingsMinor)}</strong></div> : null}
            <div className="flex justify-between border-t border-soft pt-2">
              <span>Left for everything else</span>
              <strong className={preview.shortfall ? "text-[#8B3A3A]" : "text-cyan"}>{money(preview.leftoverMinor)}</strong>
            </div>
            {preview.shortfall ? <p className="text-[#8B3A3A]">Your essentials and saving are larger than the income entered. You can go back and adjust.</p> : null}
          </div>
          <Field label="Money you have right now (PKR, optional)" htmlFor="cash" hint="Only confirmed cash — we never guess a balance.">
            <Input id="cash" type="number" min="0" max={Number.MAX_SAFE_INTEGER / 100} step="0.01" value={data.cash} onChange={(e) => patch({ cash: e.target.value })} />
          </Field>
          <p className="text-sm text-navy/70">Confirming adds these items to your plan. Everything stays editable.</p>
        </div>
      )}

      {error ? (
        <p className="mt-3 text-sm text-[#8B3A3A]" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {step > 0 ? (
          <Button type="button" variant="secondary" onClick={back} disabled={busy}>
            Back
          </Button>
        ) : null}
        {step < STEPS.length - 1 ? (
          <Button type="button" onClick={next}>
            {step === 0 ? "Let's build my month" : "Continue"}
          </Button>
        ) : (
          <Button type="button" onClick={finish} disabled={busy}>
            {busy ? "Saving…" : "Confirm and open dashboard"}
          </Button>
        )}
        {step > 0 && step < STEPS.length - 1 ? (
          <button className="text-sm text-cyan" type="button" onClick={() => { setError(""); setStep((s) => s + 1); }}>
            Skip this
          </button>
        ) : null}
      </div>
    </Card>
  );
}
