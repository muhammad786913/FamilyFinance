import Link from "next/link";

export function Logo({ className = "" }) {
  return (
    <Link href="/" className={`inline-flex items-center gap-2 font-semibold text-navy ${className}`}>
      <img src="/logo.svg" alt="" width={32} height={32} />
      FamilyFinance
    </Link>
  );
}
