"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { Logo } from "./Logo";
import { NavIcon } from "./NavIcon";

const LINKS = [
  { label: "Features", href: "/features", hint: "What the planner does" },
  { label: "Help", href: "/help", hint: "Guides and answers" },
  { label: "FAQ", href: "/faq", hint: "Common questions" },
];

export function PublicHeader() {
  const { status } = useSession();
  const path = usePathname();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const closeRef = useRef(null);
  const signedIn = status === "authenticated";

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

  return (
    <header className="sticky top-0 z-30 border-b border-soft bg-white/95 backdrop-blur">
      <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Logo />
        <nav aria-label="Primary" className="hidden items-center gap-1 text-sm md:flex">
          {LINKS.map((link) => {
            const active = path === link.href;
            return (
              <Link
                key={link.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-lg px-3 py-2 transition ${
                  active ? "bg-powder font-semibold text-navy" : "text-navy/80 hover:bg-powder hover:text-navy"
                }`}
                href={link.href}
              >
                {link.label}
              </Link>
            );
          })}
          {status === "loading" ? (
            <span className="ml-2 h-9 w-24 animate-pulse rounded-lg bg-powder" aria-hidden="true" />
          ) : signedIn ? (
            <>
              <Link
                className="ml-2 inline-flex min-h-10 items-center rounded-lg bg-cyan px-3 font-semibold text-white hover:bg-cyan/90"
                href="/dashboard"
              >
                Dashboard
              </Link>
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  await signOut({ callbackUrl: "/" });
                }}
                className="rounded-lg px-3 py-2 text-navy hover:bg-powder disabled:opacity-50"
              >
                {busy ? "Signing out…" : "Log out"}
              </button>
            </>
          ) : (
            <>
              <Link className="rounded-lg px-3 py-2 text-navy hover:bg-powder" href="/login">
                Log in
              </Link>
              <Link
                className="ml-1 inline-flex min-h-10 items-center rounded-lg bg-cyan px-3 font-semibold text-white hover:bg-cyan/90"
                href="/signup"
              >
                Create account
              </Link>
            </>
          )}
        </nav>

        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
          aria-controls="public-drawer"
          className="grid h-11 w-11 place-items-center rounded-lg border border-soft text-navy hover:bg-powder md:hidden"
        >
          <NavIcon name="menu" className="h-5 w-5" />
        </button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-navy/40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            id="public-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Site menu"
            className="absolute inset-y-0 right-0 flex w-80 max-w-[88vw] flex-col bg-white shadow-xl"
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
                <NavIcon name="close" className="h-5 w-5" />
              </button>
            </div>

            <nav aria-label="Site" className="flex-1 overflow-y-auto px-3 py-4">
              <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-navy/70">Explore</p>
              <ul className="grid gap-0.5">
                {LINKS.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      onClick={() => setOpen(false)}
                      aria-current={path === link.href ? "page" : undefined}
                      className={`block rounded-lg px-3 py-2.5 text-sm ${
                        path === link.href ? "bg-cyan font-semibold text-white" : "text-navy hover:bg-powder"
                      }`}
                    >
                      <span className="block font-medium">{link.label}</span>
                      <span className={`text-xs ${path === link.href ? "text-white/80" : "text-navy/75"}`}>{link.hint}</span>
                    </Link>
                  </li>
                ))}
              </ul>

              <p className="mt-5 px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-navy/70">Account</p>
              <ul className="grid gap-0.5">
                {status === "loading" ? (
                  <li className="px-3 py-3 text-sm text-navy/75">Checking session…</li>
                ) : signedIn ? (
                  <>
                    <li>
                      <Link
                        href="/dashboard"
                        onClick={() => setOpen(false)}
                        className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm text-navy hover:bg-powder"
                      >
                        <NavIcon name="dashboard" className="h-[18px] w-[18px]" />
                        Open dashboard
                      </Link>
                    </li>
                    <li>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={async () => {
                          setBusy(true);
                          await signOut({ callbackUrl: "/" });
                        }}
                        className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm text-navy hover:bg-powder disabled:opacity-50"
                      >
                        <NavIcon name="logout" className="h-[18px] w-[18px]" />
                        {busy ? "Signing out…" : "Log out"}
                      </button>
                    </li>
                  </>
                ) : (
                  <>
                    <li>
                      <Link
                        href="/login"
                        onClick={() => setOpen(false)}
                        className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm text-navy hover:bg-powder"
                      >
                        <NavIcon name="logout" className="h-[18px] w-[18px]" />
                        Log in
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/signup"
                        onClick={() => setOpen(false)}
                        className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold text-navy hover:bg-powder"
                      >
                        <NavIcon name="plus" className="h-[18px] w-[18px]" />
                        Create account
                      </Link>
                    </li>
                  </>
                )}
              </ul>
            </nav>

            <div className="border-t border-soft p-4">
              <Link
                href={signedIn ? "/dashboard" : "/signup"}
                onClick={() => setOpen(false)}
                className="flex min-h-11 items-center justify-center rounded-lg bg-cyan px-4 text-sm font-semibold text-white"
              >
                {signedIn ? "Open your dashboard" : "Start planning free"}
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}

const FOOTER_GROUPS = [
  {
    title: "Product",
    links: [
      ["Features", "/features"],
      ["Help", "/help"],
      ["FAQ", "/faq"],
    ],
  },
  {
    title: "Account",
    links: [
      ["Log in", "/login"],
      ["Create account", "/signup"],
      ["Reset password", "/forgot-password"],
    ],
  },
  {
    title: "Legal",
    links: [
      ["Privacy", "/privacy"],
      ["Terms", "/terms"],
    ],
  },
];

export function PublicFooter() {
  return (
    <footer className="mt-auto border-t border-soft bg-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-sm text-navy/70">
            Household cash-flow planning in PKR. Expected income stays an estimate until you record it as received.
          </p>
        </div>
        {FOOTER_GROUPS.map((group) => (
          <div key={group.title}>
            <p className="text-xs font-semibold uppercase tracking-wider text-navy/70">{group.title}</p>
            <ul className="mt-3 grid gap-2 text-sm">
              {group.links.map(([label, href]) => (
                <li key={href}>
                  <Link className="text-navy/80 hover:text-cyan" href={href}>
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-soft">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-navy/75">
          <p>FamilyFinance — household cash-flow planning</p>
          <p>Estimates, not financial advice.</p>
        </div>
      </div>
    </footer>
  );
}
