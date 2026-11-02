"use client";

import { useEffect, useRef, useState } from "react";
import { NavIcon } from "@/components/NavIcon";
import { Button, Card, Field, Input, Select } from "@/components/ui";
import { api, formatMoney } from "@/lib/format";
import { monthlyPreview } from "@/lib/onboardingPlan";

const STEPS = [
  { title: "Household", hint: "Who are we planning for?", icon: "dashboard" },
  { title: "Money in", hint: "Where does the money come from?", icon: "income" },
  { title: "Essentials", hint: "Tap the bills you actually pay.", icon: "expenses" },
  { title: "Debt", hint: "Anything you are paying off?", icon: "reports" },
  { title: "Savings", hint: "What are you building towards?", icon: "goals" },
  { title: "Big event", hint: "Is something big coming up?", icon: "events" },
  { title: "Review", hint: "One last look before we build it.", icon: "spark" },
];

const CITIES = ["Karachi", "Lahore", "Islamabad", "Rawalpindi", "Faisalabad", "Multan", "Peshawar", "Quetta"];

const BILLS = [
  { key: "rent_housing", label: "Rent or housing", icon: "dashboard", priority: 1, hint: "Rent, mortgage, or shared housing" },
  { key: "groceries", label: "Groceries", icon: "expenses", priority: 1, hint: "Food and household shopping" },
  { key: "electricity_gas_water", label: "Utilities", icon: "spark", priority: 2, hint: "Electricity, gas, water" },
  { key: "internet_phone", label: "Internet and phone", icon: "reports", priority: 3, hint: "Broadband and mobile" },
  { key: "transport", label: "Transport and fuel", icon: "simulator", priority: 3, hint: "Fuel, rickshaw, bus, careem" },
  { key: "education", label: "School fees", icon: "goals", priority: 2, childrenOnly: true, hint: "Tuition and school charges" },
  { key: "medical", label: "Medicine and health", icon: "survival", priority: 2, hint: "Regular medicines or treatment" },
  { key: "family_support", label: "Family support", icon: "events", priority: 3, hint: "Money you send to family" },
];

const SURVIVAL_KEYS = {
  rent_housing: "housing",
  groceries: "food",
  electricity_gas_water: "utilities",
  internet_phone: "utilities",
  transport: "transport",
  medical: "medical",
  education: "education",
  family_support: "other",
};

const INCOME_SOURCES = [
  { id: "salary", label: "Salary", category: "salary", frequency: "monthly", icon: "income", hint: "Fixed pay each month" },
  { id: "weekly_wage", label: "Weekly wage", category: "weekly_wage", frequency: "weekly", icon: "clock", hint: "Paid week by week" },
  { id: "daily_wage", label: "Daily wage", category: "daily_wage", frequency: "daily", icon: "spark", hint: "Paid for days worked" },
  { id: "freelance", label: "Freelance", category: "freelance", frequency: "monthly", icon: "simulator", hint: "Projects and gigs" },
  { id: "business", label: "Business", category: "business", frequency: "monthly", icon: "reports", hint: "Shop, services, trade" },
  { id: "household_contribution", label: "Family contribution", category: "household_contribution", frequency: "monthly", icon: "survival", hint: "Shared household money" },
  { id: "other", label: "Something else", category: "other", frequency: "monthly", icon: "plus", hint: "Any other regular income" },
];

const FREQUENCIES = [
  { id: "monthly", label: "Monthly" },
  { id: "weekly", label: "Weekly" },
  { id: "daily", label: "Daily" },
  { id: "yearly", label: "Yearly" },
];

const DEBT_TYPES = [
  { id: "Credit card", icon: "income" },
  { id: "Personal loan", icon: "reports" },
  { id: "Car loan", icon: "simulator" },
  { id: "Home loan", icon: "dashboard" },
  { id: "Borrowed from family", icon: "survival" },
  { id: "Other debt", icon: "plus" },
];

const GOAL_PRESETS = [
  { name: "Emergency fund", icon: "survival", hint: "A cushion for bad months" },
  { name: "Home down payment", icon: "dashboard", hint: "A place of your own" },
  { name: "Wedding", icon: "events", hint: "The big day" },
  { name: "Children's education", icon: "goals", hint: "School or university" },
  { name: "Travel", icon: "simulator", hint: "A trip to plan for" },
  { name: "New appliance", icon: "spark", hint: "Fridge, AC, or bike" },
  { name: "Custom goal", icon: "plus", hint: "Name it yourself" },
];

const EVENT_PRESETS = [
  { id: "wedding", kind: "wedding", label: "Wedding", icon: "events", hint: "Wedding or engagement" },
  { id: "eid", kind: "eid", label: "Eid", icon: "spark", hint: "Eid gifts and guests" },
  { id: "guests", kind: "guests", label: "Guests", icon: "survival", hint: "Family visiting" },
  { id: "travel", kind: "travel", label: "Travel", icon: "simulator", hint: "Trip or tickets" },
  { id: "appliance", kind: "appliance", label: "New appliance", icon: "dashboard", hint: "Fridge, AC, or bike" },
  { id: "medical", kind: "other", label: "Medical", icon: "reports", hint: "Treatment or procedure" },
  { id: "other", kind: "other", label: "Something else", icon: "plus", hint: "Name it yourself" },
];

const TARGET_MONTHS = [6, 12, 24, 36];
const EVENT_MONTHS = [1, 3, 6, 12];
const MONEY_MAX = Number.MAX_SAFE_INTEGER / 100;

function todayDay() {
  return String(Math.min(28, new Date().getDate()));
}

function isoToday() {
  return new Date().toLocaleDateString("en-CA");
}

function monthsFromNow(months) {
  const n = Math.max(1, Number(months) || 1);
  const d = new Date();
  d.setMonth(d.getMonth() + n);
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

function shortDate(ymd) {
  if (!ymd) return "—";
  return new Date(`${ymd}T00:00:00Z`).toLocaleDateString("en-PK", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function minorOf(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0 || n > MONEY_MAX) return 0;
  const minor = Math.round(n * 100);
  return Number.isSafeInteger(minor) ? minor : 0;
}

function moneyProblem(value, label, { required = false } = {}) {
  const raw = String(value ?? "").trim();
  if (!raw) return required ? `${label} is required.` : "";
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return `${label} must be a positive number.`;
  if (n > MONEY_MAX || !Number.isSafeInteger(Math.round(n * 100))) return `${label} is too large.`;
  return "";
}

function initialData() {
  const day = todayDay();
  return {
    name: "",
    city: "",
    adults: "1",
    children: "0",
    seniors: "0",
    startDay: day,
    incomeSource: "",
    incomeFrequency: "monthly",
    incomeAmount: "",
    paydayDay: "",
    bills: Object.fromEntries(BILLS.map((bill) => [bill.key, { on: false, amount: "", day }])),
    hasDebt: null,
    debtType: "",
    debtAmount: "",
    debtDay: day,
    hasGoal: null,
    goalName: "",
    goalTarget: "",
    goalMonthly: "",
    goalMonths: "12",
    hasEvent: null,
    eventKind: "wedding",
    eventName: "",
    eventAmount: "",
    eventMonths: "6",
    cash: "",
    savings: "",
    reserveChoice: "one",
    reserveCustom: "",
    survivalMode: "bills",
  };
}

function ChoiceChip({ active, onClick, children }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full border px-3 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan ${
        active ? "border-cyan bg-cyan text-white" : "border-soft bg-white text-navy hover:border-cyan hover:bg-powder"
      }`}
    >
      {children}
    </button>
  );
}

function Tile({ active, onClick, icon, title, hint }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`flex items-start gap-3 rounded-xl border p-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan ${
        active ? "border-cyan bg-powder ring-1 ring-cyan" : "border-soft bg-white hover:border-cyan hover:bg-[#F7FAFD]"
      }`}
    >
      <span
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
          active ? "bg-cyan text-white" : "bg-powder text-cyan"
        }`}
      >
        <NavIcon name={icon} className="h-[18px] w-[18px]" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold leading-tight">{title}</span>
        {hint ? <span className="mt-0.5 block text-xs leading-snug text-navy/70">{hint}</span> : null}
      </span>
    </button>
  );
}

function Stepper({ label, hint, value, onChange, min = 0, max = 20 }) {
  const n = Math.max(min, Math.min(max, Number(value) || 0));
  return (
    <div className="rounded-xl border border-soft bg-white p-3">
      <p className="text-sm font-medium">{label}</p>
      {hint ? <p className="text-xs text-navy/70">{hint}</p> : null}
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          aria-label={`One fewer ${label}`}
          onClick={() => onChange(String(Math.max(min, n - 1)))}
          disabled={n <= min}
          className="grid h-10 w-10 place-items-center rounded-lg border border-soft text-lg font-semibold hover:bg-powder disabled:opacity-40"
        >
          −
        </button>
        <span className="min-w-8 text-center text-xl font-semibold" aria-live="polite">
          {n}
        </span>
        <button
          type="button"
          aria-label={`One more ${label}`}
          onClick={() => onChange(String(Math.min(max, n + 1)))}
          disabled={n >= max}
          className="grid h-10 w-10 place-items-center rounded-lg border border-soft text-lg font-semibold hover:bg-powder disabled:opacity-40"
        >
          +
        </button>
      </div>
    </div>
  );
}

function DaySelect({ id, value, onChange }) {
  return (
    <Select id={id} value={value} onChange={onChange}>
      {Array.from({ length: 28 }, (_, index) => index + 1).map((day) => (
        <option key={day} value={day}>
          Day {day}
        </option>
      ))}
    </Select>
  );
}

function MonthPreview({ preview }) {
  const spend = preview.essentialsMinor + preview.savingsMinor;
  const pct = preview.incomeMinor > 0 ? Math.min(100, Math.round((spend / preview.incomeMinor) * 100)) : 0;
  return (
    <div className="rounded-xl border border-soft bg-white p-4 shadow-sm lg:sticky lg:top-6">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-navy/70">Your month so far</p>
      <p className="mt-1 text-2xl font-semibold leading-tight">{formatMoney(preview.incomeMinor)}</p>
      <p className="text-xs text-navy/70">Money in, per month</p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-powder" aria-hidden="true">
        <div className="h-full rounded-full bg-cyan transition-all" style={{ width: `${pct}%` }} />
      </div>
      <dl className="mt-3 grid gap-1.5 text-sm">
        <div className="flex justify-between gap-2">
          <dt className="text-navy/80">Bills</dt>
          <dd className="font-medium">{formatMoney(preview.billsMinor)}</dd>
        </div>
        {preview.debtMinor ? (
          <div className="flex justify-between gap-2">
            <dt className="text-navy/80">Debt</dt>
            <dd className="font-medium">{formatMoney(preview.debtMinor)}</dd>
          </div>
        ) : null}
        {preview.savingsMinor ? (
          <div className="flex justify-between gap-2">
            <dt className="text-navy/80">Saving</dt>
            <dd className="font-medium">{formatMoney(preview.savingsMinor)}</dd>
          </div>
        ) : null}
      </dl>
      <div className="mt-3 flex justify-between gap-2 border-t border-soft pt-2 text-sm font-semibold">
        <span>{preview.leftoverMinor < 0 ? "Short by" : "Left to plan"}</span>
        <span className={preview.leftoverMinor < 0 ? "text-[#8B3A3A]" : "text-cyan"}>
          {formatMoney(Math.abs(preview.leftoverMinor))}
        </span>
      </div>
      <p className="mt-2 text-[11px] leading-snug text-navy/70">
        Only the numbers you pick are counted. Nothing is filled in for you.
      </p>
    </div>
  );
}

function SummaryRow({ label, value, onEdit }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2 border-t border-soft py-2 text-sm first:border-t-0">
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wide text-navy/70">{label}</p>
        <p className="font-medium text-navy">{value}</p>
      </div>
      {onEdit ? (
        <button type="button" onClick={onEdit} className="text-xs font-semibold text-cyan underline underline-offset-2">
          Edit
        </button>
      ) : null}
    </div>
  );
}

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [maxStep, setMaxStep] = useState(0);
  const [data, setData] = useState(initialData);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const created = useRef({ income: false, bills: new Set(), debt: false, goal: false, event: false });

  useEffect(() => {
    let alive = true;
    api("/api/household")
      .then((res) => {
        if (!alive) return;
        if (res.household?.setupComplete) {
          window.location.replace("/dashboard");
          return;
        }
        const household = res.household || {};
        const members = Array.isArray(household.members) ? household.members : [];
        const count = (groups) => members.filter((m) => groups.includes(m.ageGroup)).length;
        setData((prev) => ({
          ...prev,
          name: household.name || prev.name,
          city: household.city || prev.city,
          adults: String(Math.max(1, count(["adult"]) || 1)),
          children: String(count(["child", "teen"])),
          seniors: String(count(["senior"])),
        }));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const patch = (part) => setData((prev) => ({ ...prev, ...part }));
  const patchBill = (key, part) =>
    setData((prev) => ({ ...prev, bills: { ...prev.bills, [key]: { ...prev.bills[key], ...part } } }));

  const children = Math.max(0, Math.min(20, Number(data.children) || 0));
  const adults = Math.max(1, Math.min(20, Number(data.adults) || 1));
  const seniors = Math.max(0, Math.min(20, Number(data.seniors) || 0));
  const startDay = Number(data.startDay) || 1;
  const paydayDay = Number(data.paydayDay) || startDay;

  const visibleBills = BILLS.filter((bill) => !(bill.childrenOnly && children <= 0));
  const selectedBills = visibleBills.filter((bill) => data.bills[bill.key].on && minorOf(data.bills[bill.key].amount) > 0);
  const billTotalMinor = selectedBills.reduce((sum, bill) => sum + minorOf(data.bills[bill.key].amount), 0);

  const preview = monthlyPreview({
    income: data.incomeAmount,
    frequency: data.incomeFrequency,
    bills: selectedBills.map((bill) => data.bills[bill.key].amount),
    debt: data.hasDebt ? data.debtAmount : 0,
    goal: data.hasGoal ? data.goalMonthly : 0,
  });

  const reserveMinor =
    data.reserveChoice === "one"
      ? preview.essentialsMinor
      : data.reserveChoice === "two"
        ? preview.essentialsMinor * 2
        : data.reserveChoice === "custom"
          ? minorOf(data.reserveCustom)
          : 0;

  const source = INCOME_SOURCES.find((item) => item.id === data.incomeSource) || null;
  const goalSuggestMinor =
    Number(data.goalTarget) > 0 && Number(data.goalMonths) > 0
      ? Math.ceil((Number(data.goalTarget) * 100) / Number(data.goalMonths))
      : 0;
  const debtLabel = data.debtType || "Debt instalment";
  const eventPreset = EVENT_PRESETS.find((item) => item.id === data.eventKind) || EVENT_PRESETS[0];

  function validate(targetStep = step) {
    if (targetStep === 0) {
      if (!String(data.name).trim()) return "Give your household a name first.";
      if (!String(data.city).trim()) return "Pick your city — it keeps survival estimates realistic.";
      if (adults + children + seniors > 20) return "Keep the household at 20 people or fewer.";
    }
    if (targetStep === 1) {
      const amountProblem = moneyProblem(data.incomeAmount, "Income amount");
      if (amountProblem) return amountProblem;
      if (Number(data.incomeAmount) > 0 && !source) return "Choose where this income comes from.";
    }
    if (targetStep === 2) {
      for (const bill of visibleBills) {
        if (!data.bills[bill.key].on) continue;
        const problem = moneyProblem(data.bills[bill.key].amount, `${bill.label} amount`, { required: true });
        if (problem) return problem;
        if (minorOf(data.bills[bill.key].amount) <= 0) return `${bill.label} needs an amount above zero.`;
      }
    }
    if (targetStep === 3 && data.hasDebt) {
      if (!data.debtType) return "Pick the type of debt.";
      const problem = moneyProblem(data.debtAmount, "Monthly instalment", { required: true });
      if (problem) return problem;
      if (minorOf(data.debtAmount) <= 0) return "Enter a monthly instalment above zero.";
    }
    if (targetStep === 4 && data.hasGoal) {
      if (!String(data.goalName).trim()) return "Pick a goal or name your own.";
      const problem = moneyProblem(data.goalTarget, "Goal amount", { required: true });
      if (problem) return problem;
      if (minorOf(data.goalTarget) <= 0) return "Enter a goal amount above zero.";
    }
    if (targetStep === 5 && data.hasEvent) {
      if (!String(data.eventName).trim()) return "Name the event, or pick one above.";
      const problem = moneyProblem(data.eventAmount, "Event amount", { required: true });
      if (problem) return problem;
      if (minorOf(data.eventAmount) <= 0) return "Enter an event amount above zero.";
    }
    if (targetStep === 6) {
      let problem = moneyProblem(data.cash, "Cash on hand");
      if (problem) return problem;
      problem = moneyProblem(data.savings, "Savings set aside");
      if (problem) return problem;
      if (data.reserveChoice === "custom") {
        problem = moneyProblem(data.reserveCustom, "Custom reserve", { required: true });
        if (problem) return problem;
      }
    }
    return "";
  }

  function goTo(target) {
    for (let index = step; index < target; index += 1) {
      const problem = validate(index);
      if (problem) {
        setStep(index);
        setError(problem);
        return;
      }
    }
    setError("");
    setStep(target);
    setMaxStep((value) => Math.max(value, target));
  }

  function next() {
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setError("");
    const target = Math.min(STEPS.length - 1, step + 1);
    setStep(target);
    setMaxStep((value) => Math.max(value, target));
  }

  function back() {
    setError("");
    setStep((value) => Math.max(0, value - 1));
  }

  function skip() {
    if (step === 1) patch({ incomeSource: "", incomeAmount: "" });
    if (step === 2) patch({ bills: Object.fromEntries(BILLS.map((bill) => [bill.key, { ...data.bills[bill.key], on: false }])) });
    if (step === 3) patch({ hasDebt: false });
    if (step === 4) patch({ hasGoal: false });
    if (step === 5) patch({ hasEvent: false });
    setError("");
    const target = Math.min(STEPS.length - 1, step + 1);
    setStep(target);
    setMaxStep((value) => Math.max(value, target));
  }

  async function finish() {
    const problem = validate(6);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const members = [
        ...Array.from({ length: adults }, (_, index) => ({ label: `Adult ${index + 1}`, ageGroup: "adult" })),
        ...Array.from({ length: children }, (_, index) => ({ label: `Child ${index + 1}`, ageGroup: "child" })),
        ...Array.from({ length: seniors }, (_, index) => ({ label: `Elder ${index + 1}`, ageGroup: "senior" })),
      ];
      await api("/api/household", {
        method: "PATCH",
        body: {
          name: String(data.name).trim().slice(0, 80),
          city: String(data.city).trim().slice(0, 80),
          planningStartDay: startDay,
          members,
        },
      });

      if (!created.current.income && Number(data.incomeAmount) > 0 && source) {
        await api("/api/income", {
          method: "POST",
          body: {
            name: `${source.label} income`,
            amount: data.incomeAmount,
            expectedDate: nextDue(paydayDay),
            category: source.category,
            frequency: data.incomeFrequency,
            estimated: true,
            notes: "Added during onboarding",
          },
        });
        created.current.income = true;
      }

      for (const bill of selectedBills) {
        if (created.current.bills.has(bill.key)) continue;
        await api("/api/expenses", {
          method: "POST",
          body: {
            name: bill.label,
            category: bill.key,
            amount: data.bills[bill.key].amount,
            dueDate: nextDue(data.bills[bill.key].day),
            frequency: "monthly",
            essential: true,
            priority: bill.priority,
            notes: "Added during onboarding",
          },
        });
        created.current.bills.add(bill.key);
      }

      if (data.hasDebt && Number(data.debtAmount) > 0 && !created.current.debt) {
        await api("/api/expenses", {
          method: "POST",
          body: {
            name: `${debtLabel} payment`,
            category: "debt",
            amount: data.debtAmount,
            dueDate: nextDue(data.debtDay),
            frequency: "monthly",
            essential: true,
            priority: 2,
            notes: `Debt type: ${debtLabel}. Added during onboarding`,
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
            targetDate: monthsFromNow(data.goalMonths),
            priority: 3,
            notes: "Added during onboarding",
          },
        });
        created.current.goal = true;
      }

      if (data.hasEvent && !created.current.event) {
        await api("/api/events", {
          method: "POST",
          body: {
            name: String(data.eventName).trim(),
            kind: eventPreset.kind,
            amount: data.eventAmount,
            targetDate: monthsFromNow(data.eventMonths),
            priority: 5,
            includeInPlan: true,
            notes: "Added during onboarding",
          },
        });
        created.current.event = true;
      }

      const survival = {
        housing: 0,
        food: 0,
        utilities: 0,
        transport: 0,
        medical: 0,
        education: 0,
        other: 0,
        useLocationEstimates: data.survivalMode === "city",
      };
      if (data.survivalMode === "bills") {
        for (const bill of selectedBills) {
          const key = SURVIVAL_KEYS[bill.key];
          if (key) survival[key] += Number(data.bills[bill.key].amount) || 0;
        }
      }

      await api("/api/household", {
        method: "PATCH",
        body: {
          startingBalance: data.cash || 0,
          savingsBalance: data.savings || 0,
          emergencyReserve: (reserveMinor / 100).toFixed(2),
          survival,
          setupComplete: true,
        },
      });
      window.location.href = "/dashboard";
    } catch (err) {
      setError(`${err.message} Nothing was lost — press Confirm again and finished items are skipped.`);
    } finally {
      setBusy(false);
    }
  }

  const skippable = step >= 1 && step <= 5;

  return (
    <div className="mx-auto grid max-w-5xl gap-5 lg:grid-cols-[minmax(0,1fr)_19rem]">
      <div className="min-w-0">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-navy/70">
              Step {step + 1} of {STEPS.length}
            </p>
            <h1 className="text-2xl font-semibold leading-tight sm:text-3xl">{STEPS[step].hint}</h1>
          </div>
          <p className="inline-flex items-center gap-2 rounded-full bg-powder px-3 py-1 text-xs font-semibold">
            <NavIcon name="spark" className="h-4 w-4 text-cyan" />
            About 2 minutes
          </p>
        </div>

        <ol className="mb-4 flex flex-wrap gap-1.5" aria-label="Setup steps">
          {STEPS.map((item, index) => {
            const done = index < step || index <= maxStep;
            const current = index === step;
            const reachable = index <= maxStep;
            return (
              <li key={item.title}>
                <button
                  type="button"
                  disabled={!reachable || busy}
                  aria-current={current ? "step" : undefined}
                  onClick={() => goTo(index)}
                  className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                    current
                      ? "border-cyan bg-cyan text-white"
                      : done
                        ? "border-soft bg-powder text-navy hover:border-cyan"
                        : "border-soft bg-white text-navy/70"
                  }`}
                >
                  <span
                    className={`grid h-5 w-5 place-items-center rounded-full text-[10px] ${
                      current ? "bg-white/20" : "bg-white text-cyan"
                    }`}
                    aria-hidden="true"
                  >
                    {index + 1}
                  </span>
                  <span className="hidden sm:inline">{item.title}</span>
                </button>
              </li>
            );
          })}
        </ol>

        <div className="h-1.5 overflow-hidden rounded-full bg-powder" aria-hidden="true">
          <div className="h-full rounded-full bg-cyan transition-all" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
        </div>

        <Card className="mt-4">
          {step === 0 && (
            <div className="grid gap-5">
              <Field label="Household name" htmlFor="name" hint="We suggested one from your signup — keep it or rename it.">
                <Input
                  id="name"
                  value={data.name}
                  onChange={(event) => patch({ name: event.target.value })}
                  maxLength={80}
                  placeholder="e.g. Ahmed family"
                  required
                />
              </Field>

              <div>
                <p className="text-sm font-medium">Which city do you live in?</p>
                <p className="text-xs text-navy/70">Used for realistic essentials estimates on the survival page.</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {CITIES.map((city) => (
                    <ChoiceChip key={city} active={data.city === city} onClick={() => patch({ city })}>
                      {city}
                    </ChoiceChip>
                  ))}
                </div>
                <div className="mt-2">
                  <Input
                    aria-label="Another city"
                    value={CITIES.includes(data.city) ? "" : data.city}
                    onChange={(event) => patch({ city: event.target.value })}
                    maxLength={80}
                    placeholder="Or type another city"
                  />
                </div>
              </div>

              <div>
                <p className="text-sm font-medium">Who lives with you?</p>
                <p className="text-xs text-navy/70">Tap + and − to set the household size.</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  <Stepper label="Adults" value={data.adults} onChange={(value) => patch({ adults: value })} min={1} max={20} />
                  <Stepper label="Children" hint="Adds school fees" value={data.children} onChange={(value) => patch({ children: value })} min={0} max={20} />
                  <Stepper label="Elders" value={data.seniors} onChange={(value) => patch({ seniors: value })} min={0} max={20} />
                </div>
              </div>

              <Field
                label="When does your planning month start?"
                htmlFor="startDay"
                hint={`This cycle will start on ${shortDate(nextDue(startDay))}. Most people pick their payday.`}
              >
                <DaySelect id="startDay" value={data.startDay} onChange={(event) => patch({ startDay: event.target.value })} />
              </Field>
            </div>
          )}

          {step === 1 && (
            <div className="grid gap-5">
              <div>
                <p className="text-sm font-medium">Where does most of your money come from?</p>
                <p className="text-xs text-navy/70">Pick one — you can add more later.</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {INCOME_SOURCES.map((item) => (
                    <Tile
                      key={item.id}
                      active={data.incomeSource === item.id}
                      onClick={() =>
                        patch({
                          incomeSource: item.id,
                          incomeFrequency: item.frequency,
                        })
                      }
                      icon={item.icon}
                      title={item.label}
                      hint={item.hint}
                    />
                  ))}
                </div>
              </div>

              <Field
                label={data.incomeFrequency === "monthly" ? "Typical monthly take-home (PKR)" : "Typical amount per payment (PKR)"}
                htmlFor="incomeAmount"
                hint="Use the money you actually receive, not the salary on paper."
              >
                <Input
                  id="incomeAmount"
                  inputMode="decimal"
                  type="number"
                  min="0"
                  step="0.01"
                  max={MONEY_MAX}
                  value={data.incomeAmount}
                  onChange={(event) => patch({ incomeAmount: event.target.value })}
                  placeholder="0"
                  autoFocus
                />
              </Field>

              <div>
                <p className="text-sm font-medium">How often is it paid?</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {FREQUENCIES.map((item) => (
                    <ChoiceChip
                      key={item.id}
                      active={data.incomeFrequency === item.id}
                      onClick={() => patch({ incomeFrequency: item.id })}
                    >
                      {item.label}
                    </ChoiceChip>
                  ))}
                </div>
              </div>

              <Field
                label="Which day do you usually get paid?"
                htmlFor="payday"
                hint={`Next payment will be recorded on ${shortDate(nextDue(paydayDay))}.`}
              >
                <DaySelect
                  id="payday"
                  value={String(paydayDay)}
                  onChange={(event) => patch({ paydayDay: event.target.value })}
                />
              </Field>
            </div>
          )}

          {step === 2 && (
            <div className="grid gap-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-navy/75">Tap a bill to include it, then enter the monthly amount.</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="text-xs font-semibold text-cyan underline underline-offset-2"
                    onClick={() =>
                      patch({
                        bills: Object.fromEntries(
                          visibleBills.map((bill) => [bill.key, { ...data.bills[bill.key], on: true }])
                        ),
                      })
                    }
                  >
                    Add all
                  </button>
                  <button
                    type="button"
                    className="text-xs font-semibold text-navy/70 underline underline-offset-2"
                    onClick={() =>
                      patch({
                        bills: Object.fromEntries(
                          BILLS.map((bill) => [bill.key, { ...data.bills[bill.key], on: false }])
                        ),
                      })
                    }
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                {visibleBills.map((bill) => {
                  const entry = data.bills[bill.key];
                  return (
                    <div
                      key={bill.key}
                      className={`rounded-xl border p-3 transition ${
                        entry.on ? "border-cyan bg-[#F7FAFD]" : "border-soft bg-white"
                      }`}
                    >
                      <button
                        type="button"
                        aria-pressed={entry.on}
                        onClick={() => patchBill(bill.key, { on: !entry.on })}
                        className="flex w-full items-center gap-2 text-left"
                      >
                        <span
                          className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
                            entry.on ? "bg-cyan text-white" : "bg-powder text-cyan"
                          }`}
                        >
                          <NavIcon name={bill.icon} className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold leading-tight">{bill.label}</span>
                          <span className="block text-[11px] leading-snug text-navy/70">{bill.hint}</span>
                        </span>
                        <span
                          className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[10px] font-bold ${
                            entry.on ? "border-cyan bg-cyan text-white" : "border-soft bg-white text-transparent"
                          }`}
                          aria-hidden="true"
                        >
                          ✓
                        </span>
                      </button>
                      {entry.on ? (
                        <div className="mt-3 grid grid-cols-[minmax(0,1fr)_7rem] gap-2">
                          <div>
                            <label className="text-xs font-medium" htmlFor={`bill-amount-${bill.key}`}>
                              Monthly amount (PKR)
                            </label>
                            <Input
                              id={`bill-amount-${bill.key}`}
                              inputMode="decimal"
                              type="number"
                              min="0"
                              step="0.01"
                              max={MONEY_MAX}
                              value={entry.amount}
                              onChange={(event) => patchBill(bill.key, { amount: event.target.value })}
                              placeholder="0"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-medium" htmlFor={`bill-day-${bill.key}`}>
                              Due day
                            </label>
                            <DaySelect
                              id={`bill-day-${bill.key}`}
                              value={entry.day}
                              onChange={(event) => patchBill(bill.key, { day: event.target.value })}
                            />
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              {selectedBills.length ? (
                <p className="rounded-lg bg-powder p-3 text-sm">
                  {selectedBills.length} bill{selectedBills.length === 1 ? "" : "s"} selected ·{" "}
                  <strong>{formatMoney(billTotalMinor)}</strong> per month
                </p>
              ) : (
                <p className="rounded-lg bg-powder p-3 text-sm text-navy/80">
                  Nothing selected yet. Bills are optional, but they make the cash timeline useful.
                </p>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="grid gap-4">
              <div className="grid gap-2 sm:grid-cols-2">
                <Tile
                  active={data.hasDebt === true}
                  onClick={() => patch({ hasDebt: true })}
                  icon="reports"
                  title="Yes, I am paying something off"
                  hint="Loan, credit card, or borrowed money"
                />
                <Tile
                  active={data.hasDebt === false}
                  onClick={() => patch({ hasDebt: false })}
                  icon="survival"
                  title="No debt right now"
                  hint="Nothing to add here"
                />
              </div>

              {data.hasDebt ? (
                <>
                  <div>
                    <p className="text-sm font-medium">What kind of debt is it?</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {DEBT_TYPES.map((item) => (
                        <ChoiceChip key={item.id} active={data.debtType === item.id} onClick={() => patch({ debtType: item.id })}>
                          <NavIcon name={item.icon} className="h-4 w-4" />
                          {item.id}
                        </ChoiceChip>
                      ))}
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Monthly instalment (PKR)" htmlFor="debtAmount">
                      <Input
                        id="debtAmount"
                        inputMode="decimal"
                        type="number"
                        min="0"
                        step="0.01"
                        max={MONEY_MAX}
                        value={data.debtAmount}
                        onChange={(event) => patch({ debtAmount: event.target.value })}
                        placeholder="0"
                      />
                    </Field>
                    <Field label="Due day" htmlFor="debtDay" hint="Used for the first month; it repeats monthly.">
                      <DaySelect id="debtDay" value={data.debtDay} onChange={(event) => patch({ debtDay: event.target.value })} />
                    </Field>
                  </div>
                </>
              ) : null}
            </div>
          )}

          {step === 4 && (
            <div className="grid gap-4">
              <div className="grid gap-2 sm:grid-cols-2">
                <Tile
                  active={data.hasGoal === true}
                  onClick={() => patch({ hasGoal: true })}
                  icon="goals"
                  title="Yes, I am saving for something"
                  hint="One goal is enough to start"
                />
                <Tile
                  active={data.hasGoal === false}
                  onClick={() => patch({ hasGoal: false })}
                  icon="clock"
                  title="Not right now"
                  hint="Skip this step"
                />
              </div>

              {data.hasGoal ? (
                <>
                  <div>
                    <p className="text-sm font-medium">What are you saving for?</p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {GOAL_PRESETS.map((preset) => (
                        <Tile
                          key={preset.name}
                          active={data.goalName === preset.name}
                          onClick={() => patch({ goalName: preset.name })}
                          icon={preset.icon}
                          title={preset.name}
                          hint={preset.hint}
                        />
                      ))}
                    </div>
                  </div>

                  <Field label="Goal name" htmlFor="goalName" hint="Shown on your dashboard and plan.">
                    <Input
                      id="goalName"
                      value={data.goalName}
                      onChange={(event) => patch({ goalName: event.target.value })}
                      maxLength={120}
                      placeholder="e.g. Emergency fund"
                    />
                  </Field>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Goal amount (PKR)" htmlFor="goalTarget">
                      <Input
                        id="goalTarget"
                        inputMode="decimal"
                        type="number"
                        min="0"
                        step="0.01"
                        max={MONEY_MAX}
                        value={data.goalTarget}
                        onChange={(event) => patch({ goalTarget: event.target.value })}
                        placeholder="0"
                      />
                    </Field>
                    <div>
                      <p className="text-sm font-medium">How long do you have?</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {TARGET_MONTHS.map((months) => (
                          <ChoiceChip
                            key={months}
                            active={Number(data.goalMonths) === months}
                            onClick={() => patch({ goalMonths: String(months) })}
                          >
                            {months} months
                          </ChoiceChip>
                        ))}
                      </div>
                      <p className="mt-1 text-xs text-navy/70">Target date: {shortDate(monthsFromNow(data.goalMonths))}</p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-soft bg-powder p-3">
                    <p className="text-sm font-semibold">
                      {goalSuggestMinor > 0 ? `Save about ${formatMoney(goalSuggestMinor)} a month` : "Monthly saving is optional"}
                    </p>
                    <p className="mt-0.5 text-xs text-navy/75">
                      This is simple division of the amount and months you picked — no guessing.
                    </p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                      <Field label="Monthly saving (PKR)" htmlFor="goalMonthly">
                        <Input
                          id="goalMonthly"
                          inputMode="decimal"
                          type="number"
                          min="0"
                          step="0.01"
                          max={MONEY_MAX}
                          value={data.goalMonthly}
                          onChange={(event) => patch({ goalMonthly: event.target.value })}
                          placeholder="0"
                        />
                      </Field>
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={goalSuggestMinor <= 0}
                        onClick={() => patch({ goalMonthly: (goalSuggestMinor / 100).toFixed(2) })}
                      >
                        Use suggestion
                      </Button>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          )}

          {step === 5 && (
            <div className="grid gap-4">
              <div className="grid gap-2 sm:grid-cols-2">
                <Tile
                  active={data.hasEvent === true}
                  onClick={() => patch({ hasEvent: true })}
                  icon="events"
                  title="Yes, something big is coming"
                  hint="Wedding, Eid, travel, a large purchase"
                />
                <Tile
                  active={data.hasEvent === false}
                  onClick={() => patch({ hasEvent: false })}
                  icon="clock"
                  title="Nothing planned"
                  hint="You can add events later"
                />
              </div>

              {data.hasEvent ? (
                <>
                  <div>
                    <p className="text-sm font-medium">What kind of event?</p>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {EVENT_PRESETS.map((preset) => (
                        <Tile
                          key={preset.id}
                          active={data.eventKind === preset.id}
                          onClick={() =>
                            patch({
                              eventKind: preset.id,
                              eventName: preset.id === "other" ? "" : preset.label,
                            })
                          }
                          icon={preset.icon}
                          title={preset.label}
                          hint={preset.hint}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Event name" htmlFor="eventName">
                      <Input
                        id="eventName"
                        value={data.eventName}
                        onChange={(event) => patch({ eventName: event.target.value })}
                        maxLength={120}
                        placeholder="e.g. Cousin's wedding"
                      />
                    </Field>
                    <Field label="Amount you expect to spend (PKR)" htmlFor="eventAmount">
                      <Input
                        id="eventAmount"
                        inputMode="decimal"
                        type="number"
                        min="0"
                        step="0.01"
                        max={MONEY_MAX}
                        value={data.eventAmount}
                        onChange={(event) => patch({ eventAmount: event.target.value })}
                        placeholder="0"
                      />
                    </Field>
                  </div>

                  <div>
                    <p className="text-sm font-medium">How far away is it?</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {EVENT_MONTHS.map((months) => (
                        <ChoiceChip
                          key={months}
                          active={Number(data.eventMonths) === months}
                          onClick={() => patch({ eventMonths: String(months) })}
                        >
                          {months === 1 ? "In 1 month" : `In ${months} months`}
                        </ChoiceChip>
                      ))}
                    </div>
                    <p className="mt-1 text-xs text-navy/70">
                      {eventPreset.label} on {shortDate(monthsFromNow(data.eventMonths))} · included in the plan.
                    </p>
                  </div>
                </>
              ) : null}
            </div>
          )}

          {step === 6 && (
            <div className="grid gap-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-soft bg-white p-3">
                  <p className="mb-1 text-sm font-semibold">Your setup</p>
                  <SummaryRow
                    label="Household"
                    value={`${String(data.name).trim()} · ${data.city}`}
                    onEdit={() => goTo(0)}
                  />
                  <SummaryRow
                    label="People"
                    value={`${adults} adult${adults === 1 ? "" : "s"}${children ? ` · ${children} child${children === 1 ? "" : "ren"}` : ""}${seniors ? ` · ${seniors} elder${seniors === 1 ? "" : "s"}` : ""}`}
                    onEdit={() => goTo(0)}
                  />
                  <SummaryRow label="Month starts" value={`Day ${startDay} · ${shortDate(nextDue(startDay))}`} onEdit={() => goTo(0)} />
                </div>

                <div className="rounded-xl border border-soft bg-white p-3">
                  <p className="mb-1 text-sm font-semibold">Money in</p>
                  <SummaryRow
                    label={source ? `${source.label} · ${data.incomeFrequency}` : "No income added"}
                    value={preview.incomeMinor ? `${formatMoney(preview.incomeMinor)} per month` : "Skipped"}
                    onEdit={() => goTo(1)}
                  />
                  <SummaryRow label="Payday" value={`Day ${paydayDay} · ${shortDate(nextDue(paydayDay))}`} onEdit={() => goTo(1)} />
                </div>

                <div className="rounded-xl border border-soft bg-white p-3">
                  <p className="mb-1 text-sm font-semibold">Bills and essentials</p>
                  <SummaryRow
                    label={`${selectedBills.length} bill${selectedBills.length === 1 ? "" : "s"}`}
                    value={billTotalMinor ? `${formatMoney(billTotalMinor)} per month` : "None selected"}
                    onEdit={() => goTo(2)}
                  />
                  <SummaryRow
                    label="Debt"
                    value={data.hasDebt ? `${debtLabel} · ${formatMoney(minorOf(data.debtAmount))}` : "None"}
                    onEdit={() => goTo(3)}
                  />
                </div>

                <div className="rounded-xl border border-soft bg-white p-3">
                  <p className="mb-1 text-sm font-semibold">Goals and events</p>
                  <SummaryRow
                    label="Savings goal"
                    value={
                      data.hasGoal
                        ? `${data.goalName} · ${formatMoney(minorOf(data.goalTarget))} by ${shortDate(monthsFromNow(data.goalMonths))}`
                        : "None"
                    }
                    onEdit={() => goTo(4)}
                  />
                  <SummaryRow
                    label="Big event"
                    value={
                      data.hasEvent
                        ? `${data.eventName} · ${formatMoney(minorOf(data.eventAmount))} in ${data.eventMonths} months`
                        : "None"
                    }
                    onEdit={() => goTo(5)}
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Cash you have right now (PKR, optional)" htmlFor="cash" hint="Only confirmed cash — we never guess a balance.">
                  <Input
                    id="cash"
                    inputMode="decimal"
                    type="number"
                    min="0"
                    step="0.01"
                    max={MONEY_MAX}
                    value={data.cash}
                    onChange={(event) => patch({ cash: event.target.value })}
                    placeholder="0"
                  />
                </Field>
                <Field label="Savings already set aside (PKR, optional)" htmlFor="savings" hint="Money kept separately, not your daily cash.">
                  <Input
                    id="savings"
                    inputMode="decimal"
                    type="number"
                    min="0"
                    step="0.01"
                    max={MONEY_MAX}
                    value={data.savings}
                    onChange={(event) => patch({ savings: event.target.value })}
                    placeholder="0"
                  />
                </Field>
              </div>

              <div>
                <p className="text-sm font-medium">How much emergency reserve do you want to protect?</p>
                <p className="text-xs text-navy/70">The planner keeps this amount out of safe-to-spend.</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {[
                    { id: "one", label: "1 month of essentials", value: preview.essentialsMinor },
                    { id: "two", label: "2 months of essentials", value: preview.essentialsMinor * 2 },
                    { id: "none", label: "No reserve yet", value: 0 },
                    { id: "custom", label: "Custom amount", value: minorOf(data.reserveCustom) },
                  ].map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      aria-pressed={data.reserveChoice === option.id}
                      onClick={() => patch({ reserveChoice: option.id })}
                      className={`flex items-center justify-between gap-3 rounded-xl border p-3 text-left text-sm transition ${
                        data.reserveChoice === option.id
                          ? "border-cyan bg-powder ring-1 ring-cyan"
                          : "border-soft bg-white hover:border-cyan"
                      }`}
                    >
                      <span className="font-medium">{option.label}</span>
                      <span className="shrink-0 font-semibold">{formatMoney(option.value)}</span>
                    </button>
                  ))}
                </div>
                {data.reserveChoice === "custom" ? (
                  <div className="mt-2 max-w-xs">
                    <Field label="Custom reserve (PKR)" htmlFor="reserveCustom">
                      <Input
                        id="reserveCustom"
                        inputMode="decimal"
                        type="number"
                        min="0"
                        step="0.01"
                        max={MONEY_MAX}
                        value={data.reserveCustom}
                        onChange={(event) => patch({ reserveCustom: event.target.value })}
                        placeholder="0"
                      />
                    </Field>
                  </div>
                ) : null}
              </div>

              <div>
                <p className="text-sm font-medium">How should the survival budget be filled?</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[
                    { id: "bills", label: "Use my bills above" },
                    { id: "city", label: `Use ${data.city || "city"} estimates` },
                    { id: "skip", label: "I will set it later" },
                  ].map((option) => (
                    <ChoiceChip key={option.id} active={data.survivalMode === option.id} onClick={() => patch({ survivalMode: option.id })}>
                      {option.label}
                    </ChoiceChip>
                  ))}
                </div>
                <p className="mt-1 text-xs text-navy/70">
                  {data.survivalMode === "bills"
                    ? "Housing, food, utilities, transport, health, education, and family support are copied from your selected bills."
                    : data.survivalMode === "city"
                      ? "The survival page starts from area estimates you can adjust later."
                      : "The survival page stays empty until you fill it."}
                </p>
              </div>

              <div className="rounded-xl bg-powder p-4">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span>Money in per month</span>
                  <strong>{formatMoney(preview.incomeMinor)}</strong>
                </div>
                <div className="mt-1 flex items-center justify-between gap-3 text-sm">
                  <span>Essentials, debt, and saving</span>
                  <strong>{formatMoney(preview.essentialsMinor + preview.savingsMinor)}</strong>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3 border-t border-soft pt-2 text-sm font-semibold">
                  <span>{preview.leftoverMinor < 0 ? "Short by" : "Left for everything else"}</span>
                  <span className={preview.leftoverMinor < 0 ? "text-[#8B3A3A]" : "text-cyan"}>
                    {formatMoney(Math.abs(preview.leftoverMinor))}
                  </span>
                </div>
                {preview.shortfall ? (
                  <p className="mt-2 text-sm text-[#8B3A3A]">
                    Essentials and saving are larger than your income. Go back and adjust before confirming.
                  </p>
                ) : null}
                <p className="mt-2 text-xs text-navy/75">
                  Confirming saves these decisions to your plan. Everything stays editable afterwards.
                </p>
              </div>
            </div>
          )}

          {error ? (
            <p className="mt-4 text-sm text-[#8B3A3A]" role="alert">
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
              <Button type="button" onClick={next} disabled={busy}>
                {step === 0 ? "Start my plan" : "Continue"}
              </Button>
            ) : (
              <Button type="button" onClick={finish} disabled={busy}>
                {busy ? "Building your month…" : "Confirm and open dashboard"}
              </Button>
            )}
            {skippable ? (
              <button className="text-sm font-medium text-navy/70 underline underline-offset-2" type="button" onClick={skip} disabled={busy}>
                Skip this
              </button>
            ) : null}
          </div>
        </Card>
      </div>

      <aside className="hidden lg:block" aria-label="Live monthly preview">
        <MonthPreview preview={preview} />
      </aside>
    </div>
  );
}
