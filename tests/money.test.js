const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  majorToMinor,
  minorToMajor,
  addMinor,
  MAX_MAJOR,
  MAX_INPUT_MAJOR,
  MAX_INPUT_MINOR,
} = require("../lib/money");

test("converts major units with half-up rounding", () => {
  assert.equal(majorToMinor(10.555), 1056);
  assert.equal(minorToMajor(1056), 10.56);
  // Binary multiplication loses the third decimal digit for these values;
  // the exact decimal literal must decide the paisa rounding.
  assert.equal(majorToMinor(1.005), 101);
  assert.equal(majorToMinor(1.015), 102);
  assert.equal(majorToMinor(8.165), 817);
  assert.equal(majorToMinor(0.145), 15);
  assert.equal(majorToMinor("1.005"), 101);
  assert.equal(majorToMinor("-1.005"), -101);
  assert.equal(majorToMinor("1e-3"), 0);
});

test("adds minor units without float drift", () => {
  assert.equal(addMinor(10, 20, 30), 60);
});


test("rejects amounts that cannot be represented safely in paisa", () => {
  // Use the exact decimal string: the nearest double under-represents .91.
  assert.equal(majorToMinor("90071992547409.91"), Number.MAX_SAFE_INTEGER);
  assert.throws(() => majorToMinor("90071992547409.92"), /supported limit/);
  assert.throws(() => minorToMajor(Number.MAX_SAFE_INTEGER + 1), /Invalid minor amount/);
  assert.throws(() => addMinor(Number.MAX_SAFE_INTEGER, 1), /supported limit/);
});

test("the user-input cap stays far below the representational limit", () => {
  assert.equal(MAX_INPUT_MINOR, MAX_INPUT_MAJOR * 100);
  assert.equal(MAX_INPUT_MINOR, 100_000_000_000_000);
  assert.ok(Number.isSafeInteger(MAX_INPUT_MINOR));
  assert.ok(MAX_INPUT_MAJOR < MAX_MAJOR);
});

test("onboarding and the shared money helper use the same rounding", () => {
  const onboarding = fs.readFileSync(path.join(__dirname, "../app/(app)/onboarding/page.js"), "utf8");
  assert.match(onboarding, /moneyModule\.majorToMinor\(value\)/);
  assert.match(onboarding, /moneyModule\.majorToMinor\(raw\)/);
  assert.doesNotMatch(onboarding, /Math\.round\(n \* 100\)/);
});
