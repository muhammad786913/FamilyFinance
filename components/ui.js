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
