import Link from "next/link";
import { Logo } from "./Logo";

const links = [
  ["Features", "/features"],
  ["Help", "/help"],
  ["FAQ", "/faq"],
];

export function PublicHeader() {
  return (
    <header className="border-b border-soft bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Logo />
        <nav aria-label="Primary" className="flex flex-wrap items-center gap-4 text-sm">
          {links.map(([label, href]) => (
            <Link key={href} className="text-navy hover:text-cyan" href={href}>
              {label}
            </Link>
          ))}
          <Link className="rounded-lg px-3 py-2 text-navy hover:bg-powder" href="/login">
            Log in
          </Link>
          <Link className="rounded-lg bg-cyan px-3 py-2 font-semibold text-white" href="/signup">
            Create account
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="mt-auto border-t border-soft bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap gap-4 px-4 py-6 text-sm text-navy">
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
        <Link href="/help">Help</Link>
        <p className="ml-auto">FamilyFinance — household cash-flow planning</p>
      </div>
    </footer>
  );
}
