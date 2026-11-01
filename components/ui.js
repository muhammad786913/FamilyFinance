"use client";

export function Button({ children, variant = "primary", className = "", ...props }) {
  const styles = {
    primary: "bg-cyan text-white hover:bg-cyan/90 focus-visible:outline-cyan",
    secondary: "bg-white text-navy border border-soft hover:bg-powder",
    danger: "bg-white text-[#8B3A3A] border border-[#8B3A3A] hover:bg-[#F8EEEE]",
  };
  return (
    <button
      className={`inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-semibold transition disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${styles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function Card({ children, className = "" }) {
  return <section className={`rounded-xl border border-soft bg-white p-5 shadow-sm ${className}`}>{children}</section>;
}

export function Field({ label, hint, error, children, htmlFor }) {
  return (
    <div className="grid gap-1">
      <label className="text-sm font-medium text-navy" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-navy/70">{hint}</p> : null}
      {error ? (
        <p className="text-xs text-[#8B3A3A]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Input(props) {
  return (
    <input
      className="min-h-11 w-full rounded-lg border border-soft bg-white px-3 text-navy outline-none focus:border-cyan focus:ring-2 focus:ring-cyan/30"
      {...props}
    />
  );
}

export function Select(props) {
  return (
    <select
      className="min-h-11 w-full rounded-lg border border-soft bg-white px-3 text-navy outline-none focus:border-cyan focus:ring-2 focus:ring-cyan/30"
      {...props}
    />
  );
}

export function Alert({ title, children, tone = "info" }) {
  const map = {
    info: "border-cyan bg-powder",
    warn: "border-[#B0892C] bg-[#F7F1DE]",
    danger: "border-[#8B3A3A] bg-[#F8EEEE]",
  };
  return (
    <div className={`rounded-lg border p-4 text-sm text-navy ${map[tone]}`} role="status">
      <p className="font-semibold">{title}</p>
      {children}
    </div>
  );
}

export function Empty({ title, children }) {
  return (
    <div className="rounded-xl border border-dashed border-soft bg-white p-8 text-center text-navy">
      <p className="font-semibold">{title}</p>
      <div className="mt-2 text-sm text-navy/80">{children}</div>
    </div>
  );
}

export function Badge({ children }) {
  return <span className="inline-flex rounded-full bg-powder px-2 py-0.5 text-xs font-medium text-navy">{children}</span>;
}

const STAT_TONES = {
  default: "text-navy",
  cyan: "text-navy",
  warn: "text-[#7A5C15]",
  danger: "text-[#8B3A3A]",
};

/** Compact KPI tile used across the workspace pages. */
export function StatCard({ label, value, hint, tone = "default", className = "" }) {
  return (
    <div className={`rounded-xl border border-soft bg-white p-4 shadow-sm ${className}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-navy/75">{label}</p>
      <p className={`mt-1 break-words text-xl font-semibold leading-tight sm:text-2xl ${STAT_TONES[tone] || STAT_TONES.default}`}>
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs leading-snug text-navy/75">{hint}</p> : null}
    </div>
  );
}

/** Page heading with a consistent eyebrow, description, and action slot. */
export function PageHeader({ eyebrow, title, description, actions, children }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? <p className="text-[11px] font-semibold uppercase tracking-wider text-navy/70">{eyebrow}</p> : null}
        <h1 className="text-2xl font-semibold leading-tight sm:text-3xl">{title}</h1>
        {description ? <p className="mt-1 max-w-3xl text-sm leading-relaxed text-navy/70">{description}</p> : null}
        {children}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

/** Accessible horizontal progress bar (0–100). */
export function ProgressBar({ value, tone = "cyan", label }) {
  const pct = Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
  const colors = { cyan: "bg-cyan", navy: "bg-navy", soft: "bg-soft", warn: "bg-[#B0892C]", danger: "bg-[#8B3A3A]" };
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-powder"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-label={label || "Progress"}
    >
      <div className={`h-full rounded-full ${colors[tone] || colors.cyan}`} style={{ width: `${pct}%` }} />
    </div>
  );
}
