import { PublicFooter, PublicHeader } from "@/components/PublicHeader";

export const metadata = {
  title: "Privacy policy",
  description: "How FamilyFinance handles household financial information.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col bg-bg text-navy">
      <PublicHeader />
      <main className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-3xl font-semibold">Privacy policy</h1>
        <p className="mt-4">We store the household data you enter so you can plan cash flow. Private dashboards require a signed-in account and are not published to search engines.</p>
        <p className="mt-4">Do not enter bank passwords, one-time codes, or national identity numbers. Export or delete your household data from Settings when the account owner chooses.</p>
      </main>
      <PublicFooter />
    </div>
  );
}
