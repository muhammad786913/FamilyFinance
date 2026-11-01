"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { Logo } from "./Logo";
import { InstallApp } from "./InstallApp";
import { NavIcon } from "./NavIcon";
import { NAV_GROUPS, MOBILE_NAV_ITEMS, isActivePath, navItemForPath } from "./nav";

function navGroups(path, onNavigate, { showIcons = true } = {}) {
  return NAV_GROUPS.map((group) => (
    <div key={group.label} className="mb-4">
      <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-navy/70">{group.label}</p>
      <ul className="grid gap-0.5">
        {group.items.map((item) => {
          const active = isActivePath(path, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm transition ${
                  active ? "bg-cyan font-semibold text-white shadow-sm" : "text-navy hover:bg-powder"
                }`}
              >
                {showIcons ? <NavIcon name={item.icon} className="h-[18px] w-[18px] shrink-0" /> : null}
                <span className="truncate">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  ));
}

export function AppShell({ children }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const closeRef = useRef(null);
  const current = navItemForPath(path);

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
    <div className="min-h-screen bg-bg text-navy">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2"
      >
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-soft bg-white lg:flex">
        <div className="px-5 py-5">
          <Logo href="/dashboard" />
        </div>
        <nav aria-label="App" className="flex-1 overflow-y-auto px-3 pb-4">
          {navGroups(path, undefined)}
        </nav>
        <div className="grid gap-2 border-t border-soft p-3">
          <InstallApp />
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-left text-sm font-medium text-navy hover:bg-powder"
          >
            <NavIcon name="logout" className="h-[18px] w-[18px]" />
            Log out
          </button>
        </div>
      </aside>

      {/* Always-visible mobile side rail — navigation stays on the side, not the bottom. */}
      <aside className="fixed inset-y-0 left-0 z-30 flex w-16 flex-col border-r border-soft bg-white lg:hidden">
        <div className="grid place-items-center border-b border-soft py-3">
          <Logo href="/dashboard" compact />
        </div>
        <nav aria-label="Primary" className="flex-1 overflow-y-auto px-1.5 py-3">
          <ul className="grid gap-1">
            {MOBILE_NAV_ITEMS.map((item) => {
              const active = isActivePath(path, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`grid min-h-14 place-items-center gap-0.5 rounded-xl px-1 text-[10px] font-medium leading-tight transition ${
                      active ? "bg-cyan text-white shadow-sm" : "text-navy/75 hover:bg-powder hover:text-navy"
                    }`}
                  >
                    <NavIcon name={item.icon} className="h-5 w-5" />
                    <span>{item.short}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="grid gap-1 border-t border-soft px-1.5 py-2">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-expanded={open}
            aria-controls="app-drawer"
            className="grid min-h-14 place-items-center gap-0.5 rounded-xl px-1 text-[10px] font-medium text-navy/75 hover:bg-powder hover:text-navy"
          >
            <NavIcon name="menu" className="h-5 w-5" />
            <span>More</span>
          </button>
        </div>
      </aside>

      <div className="flex min-h-screen flex-col pl-16 lg:pl-64">
        <header className="sticky top-0 z-20 flex min-h-14 items-center gap-3 border-b border-soft bg-white/95 px-3 backdrop-blur lg:hidden">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-navy/75">FamilyFinance</p>
            <p className="truncate text-sm font-semibold">{current.label}</p>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <Link
              href="/settings"
              aria-label="Settings"
              className="grid h-11 w-11 place-items-center rounded-lg text-navy hover:bg-powder"
            >
              <NavIcon name="settings" className="h-5 w-5" />
            </Link>
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Open full menu"
              aria-expanded={open}
              aria-controls="app-drawer"
              className="grid h-11 w-11 place-items-center rounded-lg border border-soft text-navy hover:bg-powder"
            >
              <NavIcon name="menu" className="h-5 w-5" />
            </button>
          </div>
        </header>

        <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-3 py-5 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>

      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-navy/40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            id="app-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="App menu"
            className="absolute inset-y-0 left-0 flex w-80 max-w-[88vw] flex-col bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-soft px-4 py-3">
              <Logo href="/dashboard" />
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
            <nav aria-label="App" className="flex-1 overflow-y-auto px-3 py-4">
              {navGroups(path, () => setOpen(false))}
            </nav>
            <div className="grid gap-2 border-t border-soft p-3">
              <InstallApp />
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/" })}
                className="flex min-h-11 items-center gap-3 rounded-lg border border-soft px-3 text-left text-sm font-semibold text-navy hover:bg-powder"
              >
                <NavIcon name="logout" className="h-[18px] w-[18px]" />
                Log out
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
