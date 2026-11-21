const test = require("node:test");
const assert = require("node:assert/strict");
const {
  ymd,
  moneyField,
  optionalMoneyField,
  nonNegativeNumberField,
  nonNegativeIntegerField,
  addMinorField,
  paymentIncrement,
  priorityField,
  oneOf,
  loginLimitKey,
} = require("../lib/validation");
const { MAX_INPUT_MAJOR, MAX_INPUT_MINOR } = require("../lib/money");

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
  assert.equal(moneyField(MAX_INPUT_MAJOR), MAX_INPUT_MINOR);
  assert.equal(moneyField(MAX_INPUT_MAJOR.toFixed(2)), MAX_INPUT_MINOR);
  assert.throws(() => moneyField(MAX_INPUT_MAJOR + 1), /Invalid amount/);
  assert.throws(() => moneyField(Number.MAX_SAFE_INTEGER / 100), /Invalid amount/);
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

test("optionalMoneyField leaves blanks null but validates supplied values", () => {
  assert.equal(optionalMoneyField(undefined), null);
  assert.equal(optionalMoneyField("  "), null);
  assert.equal(optionalMoneyField("12.34"), 1234);
  assert.equal(optionalMoneyField(0), 0);
  assert.throws(() => optionalMoneyField("-1"), /Invalid amount/);
});

test("paymentIncrement rejects overpayment even below the money limit", () => {
  assert.equal(paymentIncrement(300, 200, 500), 500);
  assert.equal(paymentIncrement(undefined, 0, 500), 0);
  assert.throws(() => paymentIncrement(400, 101, 500), /exceeds the outstanding amount/);
  assert.throws(() => paymentIncrement(501, 0, 500), /Invalid payment/);
  assert.throws(() => paymentIncrement(1, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER), /supported limit/);
});

test("priorityField is a bounded integer, not a coerced NaN", () => {
  assert.equal(priorityField(undefined), 5);
  assert.equal(priorityField(""), 5);
  assert.equal(priorityField("2"), 2);
  assert.equal(priorityField(9), 9);
  for (const value of ["0", "10", "1.5", "abc", Infinity, NaN]) {
    assert.throws(() => priorityField(value), /Invalid priority/, `expected rejection for ${String(value)}`);
  }
});

test("loginLimitKey normalizes an address without trusting arbitrary input", () => {
  assert.equal(loginLimitKey("  Ali@Example.COM "), "login:ali@example.com");
  assert.equal(loginLimitKey(""), null);
  assert.equal(loginLimitKey(null), null);
});

test("password reset clears the limiter for the token owner, not the request body", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const route = fs.readFileSync(path.join(__dirname, "../app/api/auth/reset-password/route.js"), "utf8");
  assert.match(route, /User\.findById\(row\.userId\)/);
  assert.match(route, /loginLimitKey\(owner\?\.email\)/);
  assert.doesNotMatch(route, /resetLimit\(`login:\$\{String\(body\.email/);
});
