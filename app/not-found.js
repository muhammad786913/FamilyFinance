import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-lg px-4 py-24 text-navy">
      <h1 className="text-3xl font-semibold">Page not found</h1>
      <p className="mt-3">That address does not exist.</p>
      <Link className="mt-6 inline-block text-cyan" href="/">
        Back to home
      </Link>
    </main>
  );
}
