import { PublicFooter, PublicHeader } from "@/components/PublicHeader";

export const metadata = {
  title: "Terms of service",
  description: "Terms for using FamilyFinance planning tools.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-bg text-navy">
      <PublicHeader />
      <main className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-3xl font-semibold">Terms of service</h1>
        <p className="mt-4">FamilyFinance provides informational cash-flow calculations. It does not offer loans, payments, investment advice, or guaranteed outcomes. You are responsible for the accuracy of amounts you enter.</p>
      </main>
      <PublicFooter />
    </div>
  );
}
