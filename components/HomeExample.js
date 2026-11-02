"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { NavIcon } from "./NavIcon";

const money = (amount) =>
  new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", maximumFractionDigits: 0 }).format(amount);

// Illustrative only. This block is never rendered for a signed-in visitor.
const EXAMPLE = {
  cashToday: 84500,
  monthEnd: 61200,
  safeToday: 1850,
  shortDays: 0,
  upcoming: [
    { label: "Salary", date: "15 Oct", amount: 185000, kind: "in" },
    { label: "Rent", date: "5 Oct", amount: -45000, kind: "out" },
    { label: "School fee", date: "10 Oct", amount: -18500, kind: "out" },
    { label: "Groceries", date: "12 Oct", amount: -9400, kind: "out" },
  ],
  bars: [62, 48, 71, 55, 38, 44, 66, 52, 30, 58, 74, 61],
};

function ExampleCard() {
  return (
    <div className="rounded-2xl border border-soft bg-bg p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">Example household · Karachi</p>
          <p className="text-xs text-navy/75">1–31 October 2026 planning cycle</p>
        </div>
        <span className="rounded-full bg-[#F7F1DE] px-2.5 py-1 text-[11px] font-semibold text-[#7A5C15]">
          Example data — not yours
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        {[
          ["Cash today", money(EXAMPLE.cashToday)],
          ["Projected month-end", money(EXAMPLE.monthEnd)],
          ["Safe to spend today", money(EXAMPLE.safeToday)],
          ["Shortage days", `${EXAMPLE.shortDays} days`],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-soft bg-white p-3">
            <p className="text-[11px] uppercase tracking-wide text-navy/70">{label}</p>
            <p className="mt-0.5 text-base font-semibold text-navy">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-xl border border-soft bg-white p-3">
        <div className="flex items-center justify-between text-xs text-navy/75">
          <span>Projected balance</span>
          <span>Zero line protected</span>
        </div>
        <div className="mt-2 flex h-20 items-end gap-1" aria-hidden="true">
          {EXAMPLE.bars.map((height, index) => (
            <div key={index} className="flex-1 rounded-t bg-soft" style={{ height: `${height}%` }} />
          ))}
        </div>
      </div>

      <ul className="mt-4 grid gap-2">
        {EXAMPLE.upcoming.map((item) => (
          <li key={item.label} className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-sm">
            <span className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${item.kind === "in" ? "bg-cyan" : "bg-soft"}`}
                aria-hidden="true"
              />
              {item.label}
              <span className="text-xs text-navy/70">{item.date}</span>
            </span>
            <span className="text-navy">
              {item.amount > 0 ? "+" : "−"}
              {money(Math.abs(item.amount))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SignedInCard() {
  return (
    <div className="rounded-2xl border border-soft bg-white p-5 shadow-sm">
      <span className="grid h-10 w-10 place-items-center rounded-lg bg-powder text-cyan">
        <NavIcon name="dashboard" />
      </span>
      <h2 className="mt-3 text-lg font-semibold">You are signed in</h2>
      <p className="mt-1 text-sm leading-relaxed text-navy/75">
        Example numbers stay on the public page. Your workspace only shows the records you enter, so nothing here can be
        mistaken for your money.
      </p>
      <ul className="mt-4 grid gap-2 text-sm">
        {[
          ["plan", "Open this month's plan", "/plan"],
          ["income", "Add or check income", "/income"],
          ["expenses", "Add or check bills", "/expenses"],
        ].map(([icon, label, href]) => (
          <li key={href}>
            <Link
              href={href}
              className="flex min-h-11 items-center gap-2 rounded-lg border border-soft px-3 text-navy hover:border-cyan hover:bg-powder"
            >
              <NavIcon name={icon} className="h-[18px] w-[18px] text-cyan" />
              <span className="font-medium">{label}</span>
              <span className="ml-auto text-navy/60" aria-hidden="true">
                →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The public home page example is only for signed-out visitors. */
export function HomeExamplePreview() {
  const { status } = useSession();
  if (status === "loading") {
    return <div className="min-h-[26rem] animate-pulse rounded-2xl border border-soft bg-powder" aria-hidden="true" />;
  }
  if (status === "authenticated") return <SignedInCard />;
  return <ExampleCard />;
}
