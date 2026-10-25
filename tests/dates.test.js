const test = require("node:test");
const assert = require("node:assert/strict");
const { addDays, addMonthsClamped, monthBounds, weekStart } = require("../lib/dates");

test("leap year month-end clamp", () => {
  assert.equal(addMonthsClamped("2024-01-31", 1), "2024-02-29");
  assert.equal(addMonthsClamped("2025-01-31", 1), "2025-02-28");
});

test("enumerates across month boundary", () => {
  assert.equal(addDays("2026-01-31", 1), "2026-02-01");
});

test("planning month starting on day 25", () => {
  const bounds = monthBounds("2026-10-26", 25);
  assert.equal(bounds.start, "2026-09-25");
  assert.equal(bounds.end, "2026-10-24");
});

test("week start Monday", () => {
  assert.equal(weekStart("2026-10-26", 1), "2026-10-26");
});
