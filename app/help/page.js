import { PublicFooter, PublicHeader } from "@/components/PublicHeader";

export const metadata = {
  title: "Help",
  description: "How to set up a household, add income and bills, and read cash-flow forecasts.",
  alternates: { canonical: "/help" },
};

export default function HelpPage() {
  return (
    <div className="flex min-h-screen flex-col bg-bg text-navy">
      <PublicHeader />
      <main className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-3xl font-semibold">Help</h1>
        <ol className="mt-6 list-decimal space-y-4 pl-5">
          <li>Create an account. You will get a household you own. We never ask for bank passwords or CNIC numbers.</li>
          <li>Complete onboarding or skip and add details later in Settings.</li>
          <li>Add income with expected dates. Mark money as received only after it arrives.</li>
          <li>Add bills with due dates. A past due date does not mark a bill paid.</li>
          <li>Open Monthly plan to see daily and weekly cash, suggested spending estimates, and possible shortages.</li>
        </ol>
      </main>
      <PublicFooter />
    </div>
  );
}
