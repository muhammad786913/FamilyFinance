export const metadata = {
  title: "Offline",
  description: "FamilyFinance is offline.",
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <main className="mx-auto grid min-h-screen max-w-md place-content-center gap-4 px-6 text-center">
      <p className="text-xs font-semibold uppercase tracking-widest text-cyan">FamilyFinance</p>
      <h1 className="text-2xl font-semibold">You are offline</h1>
      <p className="text-sm text-navy/75">
        This page is available without a connection, but your saved figures are not. Reconnect to load your household
        dashboard, bills, and plan.
      </p>
      <p className="text-sm text-navy/75">
        Nothing you entered has been lost. Data is stored on the server and appears again once you are back online.
      </p>
      <a className="mx-auto inline-flex min-h-11 items-center rounded-lg bg-cyan px-5 text-sm font-semibold text-white" href="/dashboard">
        Try again
      </a>
    </main>
  );
}
