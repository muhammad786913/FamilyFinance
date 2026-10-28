import { PublicFooter, PublicHeader } from "@/components/PublicHeader";

export const metadata = {
  title: "Features",
  description: "Income, bills, cash-flow forecasts, goals, events, what-if scenarios, and a minimum survival budget.",
  alternates: { canonical: "/features" },
};

const items = [
  ["Income and bills", "Record salaries, daily wages, rent, utilities, and partial payments."],
  ["Monthly cash-flow plan", "Day-by-day balances from your starting cash, due dates, and received income."],
  ["Goals and events", "Test whether a wedding, Eid shopping, or a bike is affordable before you commit."],
  ["What-if simulator", "Try a delayed salary or unexpected medical bill without changing real records."],
  ["Survival budget", "Estimate essential monthly costs from your household’s actual needs."],
];

export default function FeaturesPage() {
  return (
    <div className="flex min-h-screen flex-col bg-bg text-navy">
      <PublicHeader />
      <main className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-3xl font-semibold">Features</h1>
        <ul className="mt-8 grid gap-4">
          {items.map(([t, d]) => (
            <li key={t} className="rounded-xl border border-soft bg-white p-5">
              <h2 className="text-xl font-semibold">{t}</h2>
              <p className="mt-2 text-navy/80">{d}</p>
            </li>
          ))}
        </ul>
      </main>
      <PublicFooter />
    </div>
  );
}
