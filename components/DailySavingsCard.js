"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, Card, Field, Input } from "@/components/ui";
import { SavingsAnimation } from "@/components/SavingsAnimation";
import { api, formatMoney } from "@/lib/format";
import moneyModule from "@/lib/money";
import { daySaving, recentDays, summarizeSaving } from "@/lib/dailySavings";

const MAX_AMOUNT = moneyModule.MAX_INPUT_MAJOR;
const PRESETS = [0, 500, 1000, 2000];

const STATUS = {
  great: { label: "Great saving today", tone: "text-cyan" },
  good: { label: "You saved today", tone: "text-cyan" },
  used: { label: "Right on budget", tone: "text-navy" },
  over: { label: "A little over budget", tone: "text-[#8B3A3A]" },
  empty: { label: "No budget today", tone: "text-navy" },
};

function weekday(ymd) {
  return new Date(`${ymd}T00:00:00Z`).toLocaleDateString("en-PK", { weekday: "short", timeZone: "UTC" });
}

function resultMessage(result) {
  if (result.status === "great") return `${result.savedPct}% of today's safe-to-spend budget stayed unspent.`;
  if (result.status === "good") return `You kept ${formatMoney(result.savedMinor)} inside today's budget.`;
  if (result.status === "used") return "You used the full safe-to-spend amount — nothing extra, nothing left.";
  if (result.status === "over") {
    return `You spent ${formatMoney(Math.abs(result.savedMinor))} more than today's safe-to-spend amount.`;
  }
  return "Your safe-to-spend amount is Rs 0 today, so there is no extra room to save.";
}

export function DailySavingsCard({ today, todayRow, checkins = [], planDaily = [], onSaved }) {
  const todayCheckin = checkins.find((row) => row.date === today) || null;
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [animationKey, setAnimationKey] = useState(0);
  const [celebrate, setCelebrate] = useState(false);

  useEffect(() => {
    const row = checkins.find((item) => item.date === today);
    setAmount(row ? (row.spentMinor / 100).toFixed(2) : "");
  }, [checkins, today]);

  const planBudgetMinor = todayRow?.date === today ? Math.max(0, Number(todayRow.suggestedDiscretionaryMinor) || 0) : 0;
  const budgetMinor =
    todayCheckin && Number.isSafeInteger(todayCheckin.budgetMinor) ? todayCheckin.budgetMinor : planBudgetMinor;
  const result = todayCheckin ? daySaving({ budgetMinor, spentMinor: todayCheckin.spentMinor }) : null;
  const summary = summarizeSaving({ daily: planDaily, checkins });
  const recent = recentDays({ daily: planDaily, checkins, today, count: 7 });
  const mood = result && result.status !== "empty" ? (result.savedMinor > 0 ? "happy" : "sad") : null;

  async function save(event) {
    event.preventDefault();
    const raw = String(amount).trim();
    const value = raw === "" ? 0 : Number(raw);
    if (!Number.isFinite(value) || value < 0 || value > MAX_AMOUNT) {
      setError("Enter an amount between Rs 0 and Rs 1 trillion.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await api("/api/checkins", { method: "POST", body: { date: today, spent: raw || 0 } });
      onSaved?.(response.item);
      setAnimationKey((key) => key + 1);
      setCelebrate(true);
      setNotice(todayCheckin ? "Today's check-in updated." : "Today's check-in saved.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="relative overflow-hidden">
      <SavingsAnimation mood={celebrate ? mood : null} playKey={animationKey} />
      <div className="relative z-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-navy/70">Today&apos;s saving</p>
            {result ? (
              <>
                <p className={`mt-1 text-3xl font-semibold leading-tight ${result.savedMinor < 0 ? "text-[#8B3A3A]" : "text-cyan"}`}>
                  {result.savedMinor < 0 ? formatMoney(Math.abs(result.savedMinor)) : formatMoney(result.savedMinor)}
                </p>
                <p className="text-sm font-medium text-navy">
                  {result.savedMinor < 0 ? "over today's safe-to-spend" : "kept inside today's budget"}
                </p>
              </>
            ) : (
              <>
                <p className="mt-1 text-3xl font-semibold leading-tight text-navy">Not logged yet</p>
                <p className="text-sm text-navy/70">Tell us what you spent outside essentials today.</p>
              </>
            )}
          </div>
          <div className="rounded-xl bg-powder px-4 py-3 text-sm">
            <div className="flex items-baseline justify-between gap-6">
              <span className="text-navy/75">Safe to spend</span>
              <strong>{formatMoney(budgetMinor)}</strong>
            </div>
            <div className="mt-1 flex items-baseline justify-between gap-6">
              <span className="text-navy/75">Extra spending logged</span>
              <strong>{formatMoney(todayCheckin?.spentMinor ?? 0)}</strong>
            </div>
          </div>
        </div>

        {result ? (
          <p className={`mt-3 text-sm font-semibold ${STATUS[result.status]?.tone || "text-navy"}`} aria-live="polite">
            {STATUS[result.status]?.label}. <span className="font-normal text-navy/80">{resultMessage(result)}</span>
          </p>
        ) : (
          <p className="mt-3 text-sm text-navy/75" aria-live="polite">
            Logging takes a few seconds. The number is compared with today&apos;s safe-to-spend amount, not with your
            bills.
          </p>
        )}

        <form className="mt-4 grid gap-3" onSubmit={save}>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <Field
              label="Extra spending today (PKR)"
              htmlFor="dailySpent"
              hint="Shopping, eating out, and other non-essentials. Leave blank for Rs 0."
            >
              <Input
                id="dailySpent"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                max={MAX_AMOUNT}
                value={amount}
                onChange={(event) => {
                  setAmount(event.target.value);
                  setError("");
                  setNotice("");
                }}
                placeholder="0"
              />
            </Field>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : todayCheckin ? "Update today" : "Save today"}
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-navy/70">Quick pick:</span>
            {PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  setAmount(preset ? String(preset) : "0");
                  setError("");
                  setNotice("");
                }}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  String(preset) === amount
                    ? "border-cyan bg-cyan text-white"
                    : "border-soft bg-white text-navy hover:border-cyan"
                }`}
              >
                {preset === 0 ? "No extra spend" : `Rs ${preset.toLocaleString("en-PK")}`}
              </button>
            ))}
          </div>
        </form>

        {notice ? (
          <p className="mt-2 text-sm text-cyan" role="status">
            {notice}
          </p>
        ) : null}
        {error ? (
          <p className="mt-2 text-sm text-[#8B3A3A]" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-5 grid gap-4 border-t border-soft pt-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div>
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-semibold">Last 7 days</p>
              <p className="text-xs text-navy/70">
                {summary.trackedDays
                  ? `${summary.savedDays} of ${summary.trackedDays} tracked day${summary.trackedDays === 1 ? "" : "s"} saved`
                  : "No check-ins yet"}
              </p>
            </div>
            <div className="mt-2 flex h-16 items-end gap-1.5" role="img" aria-label="Last seven days of saving check-ins">
              {recent.map((day) => {
                const pct = day.logged
                  ? Math.max(6, Math.min(100, Math.round((Math.abs(day.savedMinor) / Math.max(1, day.budgetMinor)) * 100)))
                  : 0;
                const tone = !day.logged
                  ? "bg-soft/40"
                  : day.savedMinor > 0
                    ? "bg-cyan"
                    : day.savedMinor === 0
                      ? "bg-soft"
                      : "bg-[#8B3A3A]";
                const label = !day.logged
                  ? `${day.date}: not logged`
                  : day.savedMinor >= 0
                    ? `${day.date}: saved ${formatMoney(day.savedMinor)}`
                    : `${day.date}: over by ${formatMoney(Math.abs(day.savedMinor))}`;
                return (
                  <div key={day.date} className="flex flex-1 flex-col items-center gap-1">
                    <div className="flex h-12 w-full items-end rounded bg-powder/70" title={label}>
                      <div
                        className={`w-full rounded ${tone}`}
                        style={{ height: day.logged ? `${pct}%` : "3px" }}
                      />
                    </div>
                    <span className="text-[10px] text-navy/65">{weekday(day.date)}</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-navy/65">
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-cyan" aria-hidden="true" /> Saved
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-soft" aria-hidden="true" /> Full budget used
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-[#8B3A3A]" aria-hidden="true" /> Over budget
              </span>
            </div>
          </div>
          <div className="rounded-xl border border-soft bg-powder/60 px-4 py-3 text-sm sm:text-right">
            <p className="text-xs uppercase tracking-wide text-navy/70">This cycle</p>
            <p className={`mt-1 text-lg font-semibold ${summary.netSavedMinor < 0 ? "text-[#8B3A3A]" : "text-cyan"}`}>
              {summary.netSavedMinor < 0
                ? `${formatMoney(Math.abs(summary.netSavedMinor))} over`
                : `${formatMoney(summary.netSavedMinor)} saved`}
            </p>
            <p className="mt-1 text-xs text-navy/70">
              Net of checked-in days.{" "}
              <Link className="font-semibold text-cyan underline underline-offset-2" href="/goals">
                Put it in a goal
              </Link>
            </p>
          </div>
        </div>

        <p className="mt-3 text-[11px] leading-snug text-navy/65">
          This is a daily habit check-in. It does not change bills or balances — record real payments under Expenses.
        </p>
      </div>
    </Card>
  );
}
