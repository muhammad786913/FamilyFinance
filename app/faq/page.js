import { PublicFooter, PublicHeader } from "@/components/PublicHeader";

export const metadata = {
  title: "FAQ",
  description: "Answers about PKR planning, expected income, and privacy.",
  alternates: { canonical: "/faq" },
};

const faqs = [
  ["Is expected salary treated as cash?", "No. Only received amounts increase confirmed cash. Expected amounts appear as projections."],
  ["Can I use this with daily wages?", "Yes. Add daily, weekly, monthly, or irregular income."],
  ["Do you connect to my bank?", "No. You enter amounts yourself. Never share bank login details."],
  ["Are forecasts guaranteed?", "No. They are calculations from the dates and amounts you enter."],
];

export default function FaqPage() {
  return (
    <div className="flex min-h-screen flex-col bg-bg text-navy">
      <PublicHeader />
      <main className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-3xl font-semibold">FAQ</h1>
        {faqs.map(([q, a]) => (
          <section key={q} className="mt-6">
            <h2 className="text-xl font-semibold">{q}</h2>
            <p className="mt-2 text-navy/80">{a}</p>
          </section>
        ))}
      </main>
      <PublicFooter />
    </div>
  );
}
