const test = require("node:test");
const assert = require("node:assert/strict");
const {
  addPayment,
  assertAmountCoversPayments,
  assertScheduleConversionAllowed,
  hasPayments,
  nextOccurrenceKey,
  reconcilePayments,
  removePayment,
  setPaymentsTotal,
  statusAfterAmountEdit,
  statusAfterPayment,
  sumPayments,
} = require("../lib/recordIntegrity");
const { occurrenceKey } = require("../lib/engine/recurring");

const householdId = "65a000000000000000000001";

function income(overrides = {}) {
  return {
    householdId,
    name: "Salary",
    amountMinor: 100000,
    receivedMinor: 0,
    expectedDate: "2026-10-05",
    status: "expected",
    frequency: "once",
    payments: [],
    ...overrides,
  };
}

function expense(overrides = {}) {
  return {
    householdId,
    name: "Rent",
    amountMinor: 100000,
    paidMinor: 0,
    dueDate: "2026-10-03",
    status: "unpaid",
    frequency: "once",
    payments: [],
    ...overrides,
  };
}

test("partial then full receipts reconcile amount, date, and status", () => {
  const row = income();
  addPayment(row, "income", 40000, "2026-10-01", "advance");
  assert.equal(row.receivedMinor, 40000);
  assert.equal(row.receivedDate, "2026-10-01");
  assert.equal(row.status, "partial");
  assert.equal(row.payments.length, 1);

  addPayment(row, "income", 60000, "2026-10-05");
  assert.equal(row.receivedMinor, 100000);
  assert.equal(row.receivedDate, "2026-10-05");
  assert.equal(row.status, "received");
  assert.equal(sumPayments(row, "income"), 100000);
});

test("a payment cannot exceed the outstanding amount", () => {
  const row = expense({ paidMinor: 90000, payments: [{ _id: "a", amountMinor: 90000, date: "2026-10-01" }], status: "partial" });
  assert.throws(() => addPayment(row, "expense", 10001, "2026-10-02"), /outstanding amount/);
  assert.throws(() => reconcilePayments({ ...row, paidMinor: 0, amountMinor: 50000 }, "expense"), /cannot exceed/);
});

test("setPaid can correct a total down, up, or back to zero", () => {
  const row = expense({
    paidMinor: 80000,
    status: "partial",
    payments: [
      { _id: "a", amountMinor: 60000, date: "2026-10-01" },
      { _id: "b", amountMinor: 20000, date: "2026-10-02" },
    ],
  });

  setPaymentsTotal(row, "expense", 50000, "2026-10-04");
  assert.equal(sumPayments(row, "expense"), 50000);
  assert.equal(row.paidMinor, 50000);
  assert.equal(row.paidDate, "2026-10-01");
  assert.equal(row.status, "partial");
  assert.equal(row.payments.length, 1);
  assert.equal(row.payments[0].amountMinor, 50000);

  setPaymentsTotal(row, "expense", 100000, "2026-10-05", "corrected");
  assert.equal(sumPayments(row, "expense"), 100000);
  assert.equal(row.status, "paid");
  assert.equal(row.payments.at(-1).note, "corrected");

  setPaymentsTotal(row, "expense", 0);
  assert.deepEqual(row.payments, []);
  assert.equal(row.paidMinor, 0);
  assert.equal(row.paidDate, null);
  assert.equal(row.status, "unpaid");
});

test("legacy payment totals without history can be corrected exactly", () => {
  const row = income({ receivedMinor: 70000, receivedDate: "2026-10-01", status: "partial", payments: [] });
  setPaymentsTotal(row, "income", 70000, null);
  assert.equal(row.payments.length, 1);
  assert.equal(row.payments[0].amountMinor, 70000);
  assert.equal(row.receivedMinor, 70000);
  assert.equal(row.status, "partial");
});

test("removePayment reconciles the remaining history", () => {
  const row = expense({
    amountMinor: 100000,
    paidMinor: 70000,
    status: "partial",
    payments: [
      { _id: "a", amountMinor: 40000, date: "2026-10-01" },
      { _id: "b", amountMinor: 30000, date: "2026-10-02" },
    ],
  });
  removePayment(row, "expense", "a");
  assert.equal(row.payments.length, 1);
  assert.equal(row.paidMinor, 30000);
  assert.equal(row.paidDate, "2026-10-02");
  assert.equal(row.status, "partial");
  assert.throws(() => removePayment(row, "expense", "missing"), /Payment not found/);
});

test("editing an amount cannot hide money already recorded", () => {
  assert.throws(() => assertAmountCoversPayments("expense", 50000, 60000), /already recorded/);
  assert.equal(statusAfterAmountEdit("expense", 150000, 100000, "paid"), "partial");
  assert.equal(statusAfterAmountEdit("income", 100000, 0, "received"), "expected");
  assert.equal(statusAfterPayment("income", 100000, 100000, "partial"), "received");
});

test("one-off duplicate keys match the POST endpoints for each record type", () => {
  const inc = income();
  const exp = expense();
  assert.equal(
    nextOccurrenceKey("income", householdId, inc),
    occurrenceKey(`once-${householdId}-Salary-2026-10-05-100000`, "2026-10-05")
  );
  assert.equal(
    nextOccurrenceKey("expense", householdId, exp),
    occurrenceKey(`once-e-${householdId}-Rent-2026-10-03-100000`, "2026-10-03")
  );
  assert.equal(
    nextOccurrenceKey("expense", householdId, exp, { name: "Rent", date: "2026-10-04", amountMinor: 100000 }),
    occurrenceKey(`once-e-${householdId}-Rent-2026-10-04-100000`, "2026-10-04")
  );
  assert.equal(nextOccurrenceKey("income", householdId, { ...inc, frequency: "monthly" }), null);
  assert.equal(
    nextOccurrenceKey("income", householdId, { ...inc, scheduleId: "schedule-1" }),
    occurrenceKey("schedule-1", "2026-10-05")
  );
});

test("a paid once-off record cannot be converted into a repeating schedule", () => {
  const unpaid = income();
  assert.doesNotThrow(() => assertScheduleConversionAllowed("income", unpaid, "monthly"));
  const paid = income({ receivedMinor: 100000, status: "received" });
  assert.throws(() => assertScheduleConversionAllowed("income", paid, "monthly"), /repeating schedule/);
  assert.equal(hasPayments(paid, "income"), true);
  assert.equal(hasPayments(unpaid, "income"), false);
  const withHistory = income({ payments: [{ amountMinor: 1, date: "2026-10-01" }] });
  assert.throws(() => assertScheduleConversionAllowed("income", withHistory, "weekly"), /repeating schedule/);
});

test("payment history rejects unsafe amounts", () => {
  const badPayment = expense({ payments: [{ amountMinor: -1, date: "2026-10-01" }] });
  assert.throws(() => sumPayments(badPayment, "expense"), /Invalid payment history/);
  const overflow = expense({
    payments: [
      { amountMinor: Number.MAX_SAFE_INTEGER, date: "2026-10-01" },
      { amountMinor: 1, date: "2026-10-02" },
    ],
  });
  assert.throws(() => sumPayments(overflow, "expense"), /exceeds the supported limit/);
});
