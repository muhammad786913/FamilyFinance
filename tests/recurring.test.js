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
