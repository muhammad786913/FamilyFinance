const test = require("node:test");
const assert = require("node:assert/strict");
const { ymd, moneyField, oneOf } = require("../lib/validation");

test("ymd accepts real calendar dates", () => {
  assert.equal(ymd("2026-10-31"), "2026-10-31");
  assert.equal(ymd("2024-02-29"), "2024-02-29");
});

test("ymd rejects impossible or malformed dates", () => {
  for (const value of ["2026-02-30", "2026-13-01", "2026-00-10", "2026-1-01", "31-10-2026", "", null, "2026-10-31T00:00:00Z"]) {
    assert.throws(() => ymd(value), /Invalid date/, `expected rejection for ${String(value)}`);
  }
});

test("moneyField converts major units and rejects invalid values", () => {
  assert.equal(moneyField("1200.50"), 120050);
  assert.equal(moneyField(0), 0);
  assert.throws(() => moneyField(-5), /Invalid amount/);
  assert.throws(() => moneyField("abc"), /Invalid amount/);
  assert.throws(() => moneyField(0, "amount", { positive: true }), /Invalid amount/);
  assert.equal(moneyField(0.01, "amount", { positive: true }), 1);
});

test("oneOf enforces an allow-list and returns fallbacks", () => {
  assert.equal(oneOf("wedding", ["wedding", "eid"], "kind"), "wedding");
  assert.equal(oneOf("", ["wedding"], "kind", "other"), "other");
  assert.throws(() => oneOf("party", ["wedding"], "kind"), /Invalid kind/);
});
