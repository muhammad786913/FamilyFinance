const test = require("node:test");
const assert = require("node:assert/strict");
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
});

test("adds minor units without float drift", () => {
  assert.equal(addMinor(10, 20, 30), 60);
});


test("rejects amounts that cannot be represented safely in paisa", () => {
  assert.equal(majorToMinor(Number.MAX_SAFE_INTEGER / 100), Number.MAX_SAFE_INTEGER);
  assert.throws(() => majorToMinor(Number.MAX_SAFE_INTEGER / 100 + 1), /supported limit/);
  assert.throws(() => minorToMajor(Number.MAX_SAFE_INTEGER + 1), /Invalid minor amount/);
  assert.throws(() => addMinor(Number.MAX_SAFE_INTEGER, 1), /supported limit/);
});

test("the user-input cap stays far below the representational limit", () => {
  assert.equal(MAX_INPUT_MINOR, MAX_INPUT_MAJOR * 100);
  assert.equal(MAX_INPUT_MINOR, 100_000_000_000_000);
  assert.ok(Number.isSafeInteger(MAX_INPUT_MINOR));
  assert.ok(MAX_INPUT_MAJOR < MAX_MAJOR);
});
