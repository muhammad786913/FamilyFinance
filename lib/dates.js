/** Calendar dates as YYYY-MM-DD. Arithmetic uses UTC date parts to avoid TZ shifts. */

function parseYmd(ymd) {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) throw new Error("Invalid date");
  const [year, month, day] = ymd.split("-").map(Number);
  return { year, month, day };
}

function toYmd(year, month, day) {
  const dt = new Date(Date.UTC(year, month - 1, day));
  return dt.toISOString().slice(0, 10);
}

function addDays(ymd, days) {
  const { year, month, day } = parseYmd(ymd);
  return toYmd(year, month, day + days);
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function addMonthsClamped(ymd, months) {
  const { year, month, day } = parseYmd(ymd);
  const dt = new Date(Date.UTC(year, month - 1 + months, 1));
  const y = dt.getUTCFullYear();
  const m = dt.getUTCMonth() + 1;
  const last = daysInMonth(y, m);
  return toYmd(y, m, Math.min(day, last));
}

function enumerateDays(start, end) {
  const out = [];
  let cur = start;
  while (cur <= end) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

function todayInZone(timeZone = "Asia/Karachi") {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function monthBounds(ymd, planningStartDay = 1) {
  const { year, month, day } = parseYmd(ymd);
  const startDay = Math.min(Math.max(planningStartDay, 1), 28);
  let start;
  if (day >= startDay) start = toYmd(year, month, Math.min(startDay, daysInMonth(year, month)));
  else {
    const prev = addMonthsClamped(toYmd(year, month, 1), -1);
    const p = parseYmd(prev);
    start = toYmd(p.year, p.month, Math.min(startDay, daysInMonth(p.year, p.month)));
  }
  const next = addMonthsClamped(start, 1);
  const end = addDays(next, -1);
  return { start, end };
}

function weekStart(ymd, weekStartsOn = 1) {
  const { year, month, day } = parseYmd(ymd);
  const utc = Date.UTC(year, month - 1, day);
  const dow = new Date(utc).getUTCDay();
  const diff = (dow - weekStartsOn + 7) % 7;
  return addDays(ymd, -diff);
}

function inRange(ymd, start, end) {
  return ymd >= start && ymd <= end;
}

module.exports = {
  parseYmd,
  toYmd,
  addDays,
  addMonthsClamped,
  enumerateDays,
  todayInZone,
  monthBounds,
  weekStart,
  inRange,
  daysInMonth,
};
