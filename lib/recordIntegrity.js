/** Pure integrity rules shared by income and expense write endpoints. */

const { occurrenceKey } = require("./engine/recurring");

const FIELDS = {
  income: {
    amount: "amountMinor",
    paid: "receivedMinor",
    date: "receivedDate",
    planDate: "expectedDate",
    full: "received",
    partial: "partial",
    empty: "expected",
    label: "received amount",
  },
  expense: {
    amount: "amountMinor",
    paid: "paidMinor",
    date: "paidDate",
    planDate: "dueDate",
    full: "paid",
    partial: "partial",
    empty: "unpaid",
    label: "payment",
  },
};

function bad(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function configFor(kind) {
  const config = FIELDS[kind];
  if (!config) throw bad("Invalid record type");
  return config;
}

function paymentsOf(record) {
  return Array.isArray(record.payments) ? record.payments : [];
}

function sumPayments(record, kind) {
  const config = configFor(kind);
  return paymentsOf(record).reduce((sum, payment) => {
    const amount = Number(payment.amountMinor) || 0;
    if (!Number.isSafeInteger(amount) || amount < 0) throw bad(`Invalid ${config.label} history`);
    const next = sum + amount;
    if (!Number.isSafeInteger(next)) throw bad(`${config.label} exceeds the supported limit`);
    return next;
  }, 0);
}

function paidTotal(record, kind) {
  const config = configFor(kind);
  return Number(record[config.paid]) || 0;
}

function hasPayments(record, kind) {
  return paidTotal(record, kind) > 0 || paymentsOf(record).length > 0;
}

function paymentDate(record, kind) {
  const config = configFor(kind);
  const entries = paymentsOf(record);
  return entries.length ? entries[entries.length - 1].date || record[config.planDate] : null;
}

function statusAfterPayment(kind, amountMinor, paidMinor, currentStatus) {
  const config = configFor(kind);
  const amount = Number(amountMinor);
  const paid = Number(paidMinor);
  if (!Number.isSafeInteger(amount) || amount < 0 || !Number.isSafeInteger(paid) || paid < 0) {
    throw bad(`Invalid ${config.label}`);
  }
  if (paid >= amount && amount > 0) return config.full;
  if (paid > 0) return config.partial;
  if (currentStatus === config.full || currentStatus === config.partial) return config.empty;
  return currentStatus || config.empty;
}

function assertAmountCoversPayments(kind, nextAmountMinor, paidMinor) {
  const config = configFor(kind);
  const amount = Number(nextAmountMinor);
  const paid = Number(paidMinor);
  if (!Number.isSafeInteger(amount) || amount <= 0 || !Number.isSafeInteger(paid) || paid < 0) {
    throw bad("Invalid amount");
  }
  if (amount < paid) throw bad("Amount cannot be less than the money already recorded.");
  return amount;
}

function statusAfterAmountEdit(kind, nextAmountMinor, paidMinor, currentStatus) {
  const config = configFor(kind);
  assertAmountCoversPayments(kind, nextAmountMinor, paidMinor);
  if (paidMinor > 0) return statusAfterPayment(kind, nextAmountMinor, paidMinor, currentStatus);
  if (currentStatus === config.full || currentStatus === config.partial) return config.empty;
  return currentStatus || config.empty;
}

function reconcilePayments(record, kind) {
  const config = configFor(kind);
  const total = sumPayments(record, kind);
  if (total > Number(record[config.amount])) {
    throw bad(`The recorded ${config.label} cannot exceed the planned amount.`);
  }
  record[config.paid] = total;
  record[config.date] = paymentDate(record, kind);
  record.status = statusAfterPayment(kind, record[config.amount], total, record.status);
  return record;
}

function addPayment(record, kind, amountMinor, date, note = "") {
  const config = configFor(kind);
  const current = sumPayments(record, kind);
  const amount = Number(amountMinor);
  if (!Number.isSafeInteger(amount) || amount <= 0) throw bad(`Invalid ${config.label}`);
  const next = current + amount;
  if (!Number.isSafeInteger(next) || next > Number(record[config.amount])) {
    throw bad(`The ${config.label} cannot exceed the outstanding amount.`);
  }
  record.payments = paymentsOf(record);
  record.payments.push({
    amountMinor: amount,
    date,
    note: String(note || "").slice(0, 200),
  });
  return reconcilePayments(record, kind);
}

/** Sets an exact total while preserving earlier payment rows where possible. */
function setPaymentsTotal(record, kind, totalMinor, date, note = "") {
  const config = configFor(kind);
  const total = Number(totalMinor);
  const amount = Number(record[config.amount]);
  if (!Number.isSafeInteger(total) || total < 0 || total > amount) {
    throw bad(`Invalid ${config.label}`);
  }
  record.payments = paymentsOf(record).map((payment) => ({
    ...(typeof payment.toObject === "function" ? payment.toObject() : payment),
  }));
  let current = sumPayments(record, kind);
  if (total === 0) {
    record.payments = [];
  } else if (total < current) {
    let excess = current - total;
    for (let index = record.payments.length - 1; index >= 0 && excess > 0; index -= 1) {
      const row = record.payments[index];
      const rowAmount = Number(row.amountMinor) || 0;
      if (rowAmount <= excess) {
        record.payments.splice(index, 1);
        excess -= rowAmount;
      } else {
        row.amountMinor = rowAmount - excess;
        excess = 0;
      }
    }
    if (excess > 0) throw bad(`The ${config.label} cannot be below recorded history.`);
  } else if (total > current) {
    record.payments.push({
      amountMinor: total - current,
      date: date || record[config.planDate],
      note: String(note || "Corrected payment total").slice(0, 200),
    });
  }
  current = sumPayments(record, kind);
  // Older rows may have a paid total but no itemised history.
  if (current === 0 && total > 0) {
    record.payments.push({
      amountMinor: total,
      date: date || record[config.planDate],
      note: String(note || "Corrected payment total").slice(0, 200),
    });
  }
  return reconcilePayments(record, kind);
}

function removePayment(record, kind, paymentId) {
  const config = configFor(kind);
  const index = paymentsOf(record).findIndex((payment) => String(payment._id) === String(paymentId));
  if (index < 0) throw bad("Payment not found", 404);
  record.payments = paymentsOf(record);
  record.payments.splice(index, 1);
  return reconcilePayments(record, kind);
}

function nextOccurrenceKey(kind, householdId, record, changes = {}) {
  const name = changes.name ?? record.name;
  const date = changes.date ?? record[configFor(kind).planDate];
  const amountMinor = changes.amountMinor ?? record.amountMinor;
  const frequency = changes.frequency ?? record.frequency;
  if (frequency !== "once") return null;
  if (record.scheduleId) return occurrenceKey(String(record.scheduleId), date);
  // Keep the exact prefixes used by the POST endpoints so editing an unchanged
  // row resolves to the same unique key instead of creating a duplicate.
  const prefix = kind === "income" ? "once" : "once-e";
  return occurrenceKey(`${prefix}-${householdId}-${name}-${date}-${amountMinor}`, date);
}

function assertScheduleConversionAllowed(kind, record, nextFrequency) {
  if (nextFrequency !== "once" && record.frequency === "once" && hasPayments(record, kind)) {
    throw bad("A record with payments cannot be converted into a repeating schedule.");
  }
}

module.exports = {
  FIELDS,
  paymentsOf,
  sumPayments,
  paidTotal,
  hasPayments,
  statusAfterPayment,
  statusAfterAmountEdit,
  assertAmountCoversPayments,
  reconcilePayments,
  addPayment,
  setPaymentsTotal,
  removePayment,
  nextOccurrenceKey,
  assertScheduleConversionAllowed,
};
