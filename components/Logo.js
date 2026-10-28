import Link from "next/link";

export function Logo({ className = "" }) {
  return (
    <Link href="/" className={`inline-flex items-center gap-2 font-semibold text-navy ${className}`}>
      <svg width="32" height="32" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
        <rect width="64" height="64" rx="16" fill="#00A6D6" />
        <path fill="#FFFFFF" d="M18 42V22l14-8 14 8v20h-8V30H26v12h-8zm14-16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
      </svg>
      FamilyFinance
    </Link>
  );
}
