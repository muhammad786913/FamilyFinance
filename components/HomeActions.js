"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";

/** Hero buttons switch to the workspace when a session already exists. */
export function HomeActions() {
  const { status } = useSession();
  const signedIn = status === "authenticated";

  // Avoid a "signed out" flash while the session is still being fetched.
  if (status === "loading") {
    return (
      <div className="mt-6 flex flex-wrap gap-3" aria-hidden="true">
        <span className="h-12 w-44 animate-pulse rounded-lg bg-powder" />
        <span className="h-12 w-40 animate-pulse rounded-lg bg-powder" />
      </div>
    );
  }

  return (
    <div className="mt-6 flex flex-wrap gap-3">
      <Link className="rounded-lg bg-cyan px-5 py-3 font-semibold text-white" href={signedIn ? "/dashboard" : "/signup"}>
        {signedIn ? "Open your dashboard" : "Start planning"}
      </Link>
      <Link
        className="rounded-lg border border-soft bg-white px-5 py-3 font-semibold"
        href={signedIn ? "/plan" : "/features"}
      >
        {signedIn ? "See this month's plan" : "View features"}
      </Link>
    </div>
  );
}
