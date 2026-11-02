const test = require("node:test");
const assert = require("node:assert/strict");
const { generateOccurrences, occurrenceKey } = require("../lib/engine/recurring");

test("monthly occurrences are unique and not duplicated", () => {
  const schedule = { id: "rent", frequency: "monthly", anchorDate: "2026-01-05" };
  const a = generateOccurrences(schedule, "2026-01-01", "2026-03-31");
  const b = generateOccurrences(schedule, "2026-01-01", "2026-03-31");
  assert.deepEqual(
    a.map((x) => x.occurrenceKey),
    b.map((x) => x.occurrenceKey)
  );
  assert.equal(new Set(a.map((x) => x.occurrenceKey)).size, a.length);
  assert.equal(a[0].occurrenceKey, occurrenceKey("rent", "2026-01-05"));
});

test("weekly and daily salaries produce one occurrence per real pay date", () => {
  const weekly = generateOccurrences(
    { id: "salary", frequency: "weekly", anchorDate: "2026-11-02" },
    "2026-11-02",
    "2026-12-01"
  );
  assert.deepEqual(
    weekly.map((x) => x.date),
    ["2026-11-02", "2026-11-09", "2026-11-16", "2026-11-23", "2026-11-30"]
  );

  const daily = generateOccurrences(
    { id: "daily", frequency: "daily", anchorDate: "2026-11-02" },
    "2026-11-02",
    "2026-12-01"
  );
  assert.equal(daily.length, 30);
  assert.equal(daily[0].date, "2026-11-02");
  assert.equal(daily[29].date, "2026-12-01");

  const yearly = generateOccurrences(
    { id: "bonus", frequency: "yearly", anchorDate: "2026-11-02" },
    "2026-11-02",
    "2026-12-01"
  );
  assert.deepEqual(yearly.map((x) => x.date), ["2026-11-02"]);
});
