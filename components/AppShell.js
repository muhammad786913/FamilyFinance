"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Logo } from "./Logo";

const NAV = [
  ["/dashboard", "Dashboard"],
  ["/income", "Income"],
  ["/expenses", "Expenses"],
  ["/plan", "Monthly plan"],
  ["/goals", "Goals"],
  ["/events", "Events"],
  ["/simulator", "What-if"],
  ["/reports", "Reports"],
  ["/survival", "Survival budget"],
  ["/settings", "Settings"],
];

export function AppShell({ children }) {
  const path = usePathname();
  return (
    <div className="min-h-screen bg-bg text-navy">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:rounded focus:bg-white focus:px-3 focus:py-2">
        Skip to content
      </a>
      <header className="sticky top-0 z-20 border-b border-soft bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
          <Logo />
          <button className="ml-auto text-sm font-medium text-navy hover:text-cyan" type="button" onClick={() => signOut({ callbackUrl: "/" })}>
            Log out
          </button>
        </div>
        <nav aria-label="App" className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-2 pb-2">
          {NAV.map(([href, label]) => {
            const active = path === href;
            return (
              <Link
                key={href}
                href={href}
                className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm ${active ? "bg-cyan font-semibold text-white" : "text-navy hover:bg-powder"}`}
                aria-current={active ? "page" : undefined}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main id="main" className="mx-auto max-w-7xl px-4 py-6">
        {children}
      </main>
    </div>
  );
}
