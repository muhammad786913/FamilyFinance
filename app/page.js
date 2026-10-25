import Link from "next/link";
import { PublicFooter, PublicHeader } from "@/components/PublicHeader";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-bg text-navy">
      <PublicHeader />
      <main>
        <section className="mx-auto grid max-w-6xl gap-8 px-4 py-16 md:grid-cols-2 md:items-center">
          <div>
            <h1 className="text-4xl font-semibold leading-tight">See this month’s cash before it runs out.</h1>
            <p className="mt-4 text-lg text-navy/80">
              FamilyFinance helps Pakistani households track income dates, essential bills, and realistic savings — without treating expected salary as cash in hand.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link className="rounded-lg bg-cyan px-5 py-3 font-semibold text-white" href="/signup">
                Start planning
              </Link>
              <Link className="rounded-lg border border-soft bg-white px-5 py-3 font-semibold" href="/features">
                View features
              </Link>
            </div>
          </div>
          <div className="rounded-2xl border border-soft bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold text-cyan">This month</p>
            <ul className="mt-4 grid gap-3 text-sm">
              <li className="rounded-lg bg-powder p-3">Upcoming bills stay on their due dates.</li>
              <li className="rounded-lg bg-powder p-3">Expected income is projected, not counted as available.</li>
              <li className="rounded-lg bg-powder p-3">Shortages are flagged before the next payday.</li>
            </ul>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
