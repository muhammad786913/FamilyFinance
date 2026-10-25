const test = require("node:test");
const assert = require("node:assert/strict");
const { majorToMinor, minorToMajor, addMinor } = require("../lib/money");

test("converts major units with half-up rounding", () => {
  assert.equal(majorToMinor(10.555), 1056);
  assert.equal(minorToMajor(1056), 10.56);
});

test("adds minor units without float drift", () => {
  assert.equal(addMinor(10, 20, 30), 60);
});
