import Link from "next/link";
import { PublicFooter, PublicHeader } from "@/components/PublicHeader";
import { HomeActions } from "@/components/HomeActions";
import { HomeExamplePreview } from "@/components/HomeExample";
import { NavIcon } from "@/components/NavIcon";

export const metadata = {
  title: "FamilyFinance — household cash-flow planner",
  description:
    "Plan household income, bills, and savings in PKR. See when cash may run short before the next payday.",
  alternates: { canonical: "/" },
};

const CAPABILITIES = [
  {
    icon: "plan",
    title: "Day-by-day cash",
    text: "Every bill and payday placed on its real date, so you can see the exact days cash gets tight.",
  },
  {
    icon: "simulator",
    title: "What-if scenarios",
    text: "Delay a salary, raise grocery costs, or add a medical bill before it happens in real life.",
  },
  {
    icon: "goals",
    title: "Savings you can keep",
    text: "Goals are checked against projected surplus and your emergency reserve — not wishful thinking.",
  },
  {
    icon: "reports",
    title: "Plan vs actual",
    text: "Compare what you planned for each category with what you actually paid this cycle.",
  },
];

const STEPS = [
  {
    step: "01",
    title: "Add the money you expect",
    text: "Salary, daily wages, freelance work — each with its own date. Nothing is counted as cash until you mark it received.",
  },
  {
    step: "02",
    title: "Add essentials first",
    text: "Rent, utilities, school fees, medicine. Mark them essential so the planner protects them before optional spending.",
  },
  {
    step: "03",
    title: "Read the cash timeline",
    text: "See the projected balance for every day up to your next confirmed income, with shortage days flagged.",
  },
  {
    step: "04",
    title: "Test the month before it happens",
    text: "Run a what-if, adjust a goal, or trim optional bills. The plan updates without touching your real records.",
  },
];

const FEATURES = [
  { icon: "income", title: "Income by date", text: "Expected, partial, received, delayed, and cancelled — each handled differently." },
  { icon: "expenses", title: "Bills and repeats", text: "Rent and utilities repeat automatically; unpaid bills keep their original due date." },
  { icon: "survival", title: "Survival budget", text: "A separate essentials-only floor for the weeks when income is uncertain." },
  { icon: "events", title: "Weddings and shocks", text: "Check whether a big event is affordable before you commit to it." },
  { icon: "dashboard", title: "Household health", text: "An explainable score built from reserve, shortages, essentials, and income mix." },
  { icon: "reports", title: "Six-cycle history", text: "Received income and recorded spending for the last six planning cycles." },
];

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-bg text-navy">
      <PublicHeader />
      <main>
        {/* Hero */}
        <section className="border-b border-soft bg-white">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:py-16 md:grid-cols-2 md:items-center md:gap-12">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-powder px-3 py-1 text-xs font-semibold text-navy">
                <span className="h-2 w-2 rounded-full bg-cyan" aria-hidden="true" />
                Built for Pakistani households · PKR-native
              </p>
              <h1 className="mt-4 text-4xl font-semibold leading-[1.1] sm:text-5xl">
                See this month’s cash <span className="underline decoration-cyan decoration-4 underline-offset-4">before</span> it runs out.
              </h1>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-navy/80 sm:text-lg">
                FamilyFinance tracks income dates, essential bills, and realistic savings — without treating expected
                salary as cash in hand. Plan the whole cycle in a few minutes.
              </p>
              <HomeActions />
              <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs text-navy/70">
                <li className="inline-flex items-center gap-1.5">
                  <NavIcon name="survival" className="h-4 w-4 text-cyan" /> No bank connection
                </li>
                <li className="inline-flex items-center gap-1.5">
                  <NavIcon name="clock" className="h-4 w-4 text-cyan" /> 2-minute setup
                </li>
                <li className="inline-flex items-center gap-1.5">
                  <NavIcon name="spark" className="h-4 w-4 text-cyan" /> Your data stays yours
                </li>
              </ul>
            </div>

            <HomeExamplePreview />
          </div>
        </section>

        {/* Capability band */}
        <section className="mx-auto max-w-6xl px-4 py-10 sm:py-12">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {CAPABILITIES.map((item) => (
              <div key={item.title} className="rounded-xl border border-soft bg-white p-4">
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-powder text-cyan">
                  <NavIcon name={item.icon} />
                </span>
                <p className="mt-3 font-semibold">{item.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-navy/70">{item.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="border-y border-soft bg-white">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
            <div className="max-w-2xl">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-navy/70">One cycle, start to finish</p>
              <h2 className="mt-1 text-2xl font-semibold sm:text-3xl">From payday to payday, without guessing.</h2>
              <p className="mt-2 text-sm leading-relaxed text-navy/70">
                The planner follows your money in date order. Bills never move on their own, and expected income stays
                clearly separated from confirmed cash.
              </p>
            </div>
            <ol className="mt-8 grid gap-4 md:grid-cols-4">
              {STEPS.map((item) => (
                <li key={item.step} className="rounded-xl border border-soft bg-bg p-4">
                  <span className="text-xs font-semibold tracking-widest text-navy/70">{item.step}</span>
                  <p className="mt-2 font-semibold">{item.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-navy/70">{item.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-navy/70">Inside the workspace</p>
              <h2 className="mt-1 text-2xl font-semibold sm:text-3xl">More than a monthly total.</h2>
            </div>
            <Link className="text-sm font-semibold text-navy underline decoration-cyan decoration-2 underline-offset-4 hover:decoration-4" href="/features">
              See all features →
            </Link>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((item) => (
              <Link
                key={item.title}
                href="/features"
                className="group rounded-xl border border-soft bg-white p-5 transition hover:border-cyan hover:shadow-sm"
              >
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-powder text-cyan group-hover:bg-cyan group-hover:text-white">
                  <NavIcon name={item.icon} />
                </span>
                <p className="mt-3 font-semibold">{item.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-navy/70">{item.text}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* Honesty strip */}
        <section className="border-y border-soft bg-powder">
          <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 sm:grid-cols-3">
            {[
              ["Expected is not received", "Salary you have not been paid yet is projected on its date, never added to cash today."],
              ["Estimates are labelled", "Suggested daily spending is an estimate after reserve and essentials — not a guarantee."],
              ["Your data stays yours", "Export everything as JSON or CSV, or delete the household and its records at any time."],
            ].map(([title, text]) => (
              <div key={title}>
                <p className="font-semibold">{title}</p>
                <p className="mt-1 text-sm leading-relaxed text-navy/80">{text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
          <div className="overflow-hidden rounded-2xl border border-soft bg-navy px-6 py-10 text-white sm:px-10">
            <div className="flex flex-wrap items-center justify-between gap-6">
              <div className="max-w-xl">
                <h2 className="text-2xl font-semibold sm:text-3xl">Start with the month you are actually in.</h2>
                <p className="mt-2 text-sm text-white/75">
                  Add income and essentials, then watch the cash timeline update day by day. The example above is only
                  for visitors — your workspace starts empty and uses only your own numbers.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/signup"
                  className="inline-flex min-h-11 items-center rounded-lg bg-cyan px-5 text-sm font-semibold text-white hover:bg-cyan/90"
                >
                  Create a free account
                </Link>
                <Link
                  href="/login"
                  className="inline-flex min-h-11 items-center rounded-lg border border-white/30 px-5 text-sm font-semibold text-white hover:bg-white/10"
                >
                  Log in
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
