const test = require("node:test");
const assert = require("node:assert/strict");
const { ymd, moneyField, nonNegativeNumberField, nonNegativeIntegerField, addMinorField, oneOf } = require("../lib/validation");

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
  assert.equal(moneyField(Number.MAX_SAFE_INTEGER / 100), Number.MAX_SAFE_INTEGER);
  assert.throws(() => moneyField(Number.MAX_SAFE_INTEGER / 100 + 1), /Invalid amount/);
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


test("nonNegativeNumberField accepts zero and positive finite values only", () => {
  assert.equal(nonNegativeNumberField("0"), 0);
  assert.equal(nonNegativeNumberField("1.2", "expense multiplier"), 1.2);
  for (const value of ["", "abc", -1, "-0.1", Infinity, "Infinity", NaN]) {
    assert.throws(() => nonNegativeNumberField(value), /Invalid value/);
  }
});


test("nonNegativeIntegerField rejects negative, fractional, and unsafe delay values", () => {
  assert.equal(nonNegativeIntegerField("0", "delay days"), 0);
  assert.equal(nonNegativeIntegerField("12", "delay days"), 12);
  assert.equal(nonNegativeIntegerField("", "delay days"), 0);
  for (const value of ["-1", "1.5", "Infinity", Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => nonNegativeIntegerField(value, "delay days"), /Invalid delay days/);
  }
});

test("addMinorField safely accumulates payments without exceeding the supported limit", () => {
  assert.equal(addMinorField(100, 25, "payment"), 125);
  assert.equal(addMinorField(undefined, 25, "payment"), 25);
  assert.throws(() => addMinorField(Number.MAX_SAFE_INTEGER, 1, "payment"), /supported limit/);
  assert.throws(() => addMinorField(-1, 1, "payment"), /Invalid payment/);
});


test("formPayload sends false for unchecked checkboxes", () => {
  const { formPayload } = require("../lib/formPayload");
  const form = new FormData();
  form.set("name", "Rent");
  form.set("estimated", "on");
  const payload = formPayload(form, [
    { name: "estimated", type: "checkbox" },
    { name: "essential", type: "checkbox" },
  ]);
  assert.equal(payload.name, "Rent");
  assert.equal(payload.estimated, true);
  assert.equal(payload.essential, false);
});
