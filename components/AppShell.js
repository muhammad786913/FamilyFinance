"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { Logo } from "./Logo";
import { InstallApp } from "./InstallApp";

const GROUPS = [
  {
    label: "Overview",
    items: [
      ["/dashboard", "Dashboard"],
      ["/plan", "Monthly plan"],
      ["/reports", "Reports"],
      ["/simulator", "What-if simulator"],
    ],
  },
  {
    label: "Money in & out",
    items: [
      ["/income", "Income"],
      ["/expenses", "Expenses"],
      ["/goals", "Savings goals"],
      ["/events", "Special events"],
    ],
  },
  {
    label: "Household",
    items: [
      ["/survival", "Survival budget"],
      ["/settings", "Settings"],
    ],
  },
];

const MOBILE_TABS = [
  ["/dashboard", "Home"],
  ["/plan", "Plan"],
  ["/income", "Income"],
  ["/expenses", "Bills"],
];

function isActive(path, href) {
  return path === href || path.startsWith(`${href}/`);
}

export function AppShell({ children }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const closeRef = useRef(null);

  useEffect(() => {
    setOpen(false);
  }, [path]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const navGroups = (onNavigate) =>
    GROUPS.map((group) => (
      <div key={group.label} className="mb-4">
        <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-navy/50">{group.label}</p>
        <ul className="grid gap-0.5">
          {group.items.map(([href, label]) => {
            const active = isActive(path, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-11 items-center rounded-lg px-3 text-sm ${
                    active ? "bg-cyan font-semibold text-white" : "text-navy hover:bg-powder"
                  }`}
                >
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    ));

  return (
    <div className="min-h-screen bg-bg text-navy">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2"
      >
        Skip to content
      </a>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-soft bg-white lg:flex">
        <div className="px-5 py-5">
          <Logo />
        </div>
        <nav aria-label="App" className="flex-1 overflow-y-auto px-3 pb-4">
          {navGroups()}
        </nav>
        <div className="grid gap-2 border-t border-soft p-3">
          <InstallApp />
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="min-h-11 rounded-lg px-3 text-left text-sm font-medium text-navy hover:bg-powder"
          >
            Log out
          </button>
        </div>
      </aside>

      <div className="flex min-h-screen flex-col lg:pl-64">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-soft bg-white px-3 py-2 lg:hidden">
          <button
            type="button"
            aria-label="Open menu"
            aria-expanded={open}
            aria-controls="app-drawer"
            onClick={() => setOpen(true)}
            className="grid h-11 w-11 place-items-center rounded-lg border border-soft text-navy"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
              <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <Logo />
          <Link
            href="/settings"
            aria-label="Settings"
            className="ml-auto grid h-11 w-11 place-items-center rounded-lg text-navy hover:bg-powder"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v3m0 14v3M2 12h3m14 0h3M4.9 4.9l2.1 2.1m10 10 2.1 2.1m0-14.2-2.1 2.1m-10 10-2.1 2.1" strokeLinecap="round" />
            </svg>
          </Link>
        </header>

        <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-5 pb-28 sm:px-6 lg:px-8 lg:py-8 lg:pb-10">
          {children}
        </main>

        <nav
          aria-label="Primary"
          className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-soft bg-white pb-[env(safe-area-inset-bottom)] lg:hidden"
        >
          {MOBILE_TABS.map(([href, label]) => {
            const active = isActive(path, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs ${
                  active ? "font-semibold text-cyan" : "text-navy/70"
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-cyan" : "bg-soft"}`} aria-hidden="true" />
                {label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-expanded={open}
            aria-controls="app-drawer"
            className="flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs text-navy/70"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-soft" aria-hidden="true" />
            More
          </button>
        </nav>
      </div>

      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-navy/40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            id="app-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="App menu"
            className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-soft px-4 py-3">
              <Logo />
              <button
                type="button"
                ref={closeRef}
                aria-label="Close menu"
                onClick={() => setOpen(false)}
                className="grid h-11 w-11 place-items-center rounded-lg text-navy hover:bg-powder"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                  <path d="M5 5l10 10M15 5 5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <nav aria-label="App" className="flex-1 overflow-y-auto px-3 py-4">
              {navGroups(() => setOpen(false))}
            </nav>
            <div className="grid gap-2 border-t border-soft p-3">
              <InstallApp />
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/" })}
                className="min-h-11 rounded-lg border border-soft px-3 text-left text-sm font-semibold text-navy hover:bg-powder"
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
