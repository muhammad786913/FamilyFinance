const test = require("node:test");
const assert = require("node:assert/strict");
const { addDays, addMonthsClamped, monthBounds, weekStart, inRange } = require("../lib/dates");

test("leap year month-end clamp", () => {
  assert.equal(addMonthsClamped("2024-01-31", 1), "2024-02-29");
  assert.equal(addMonthsClamped("2025-01-31", 1), "2025-02-28");
});

test("enumerates across month boundary", () => {
  assert.equal(addDays("2026-01-31", 1), "2026-02-01");
});

test("planning month starting on day 25", () => {
  const bounds = monthBounds("2026-10-26", 25);
  assert.equal(bounds.start, "2026-10-25");
  assert.equal(bounds.end, "2026-11-24");
});

test("planning month before the start day belongs to the previous cycle", () => {
  const bounds = monthBounds("2026-10-24", 25);
  assert.equal(bounds.start, "2026-09-25");
  assert.equal(bounds.end, "2026-10-24");
});

test("week start Monday", () => {
  assert.equal(weekStart("2026-10-26", 1), "2026-10-26");
});

test("default planning month uses the calendar month", () => {
  const bounds = monthBounds("2026-10-26", 1);
  assert.equal(bounds.start, "2026-10-01");
  assert.equal(bounds.end, "2026-10-31");
});

test("planning start day is clamped to the 28th", () => {
  const bounds = monthBounds("2026-03-15", 31);
  assert.equal(bounds.start, "2026-02-28");
  assert.equal(bounds.end, "2026-03-27");
});

test("week start can be Sunday", () => {
  assert.equal(weekStart("2026-10-26", 0), "2026-10-25");
});

test("addMonthsClamped walks backwards across a year", () => {
  assert.equal(addMonthsClamped("2026-01-15", -1), "2025-12-15");
  assert.equal(addMonthsClamped("2024-03-31", -1), "2024-02-29");
});

test("inRange is inclusive", () => {
  assert.equal(inRange("2026-10-01", "2026-10-01", "2026-10-31"), true);
  assert.equal(inRange("2026-10-31", "2026-10-01", "2026-10-31"), true);
  assert.equal(inRange("2026-11-01", "2026-10-01", "2026-10-31"), false);
});
