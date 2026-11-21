import mongoose from "mongoose";
import Expense from "@/models/Expense";
import {
  json,
  requireSession,
  requireMembership,
  parseJson,
  assertWrite,
  handle,
  moneyField,
  ymd,
  audit,
  oneOf,
  priorityField,
} from "@/lib/api";
import { EXPENSE_CATEGORIES, FREQUENCIES, EXPENSE_STATUSES } from "@/lib/constants";
import {
  addPayment,
  assertScheduleConversionAllowed,
  nextOccurrenceKey,
  paidTotal,
  removePayment,
  setPaymentsTotal,
  statusAfterAmountEdit,
} from "@/lib/recordIntegrity";

async function load(membership, id) {
  if (!mongoose.isValidObjectId(id)) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }
  const item = await Expense.findOne({ _id: id, householdId: membership.householdId });
  if (!item) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }
  return item;
}

export async function PATCH(req, { params }) {
  let duplicateFilter = null;
  try {
    const { id } = await params;
    const session = await requireSession();
    const membership = await requireMembership(session.user.id);
    assertWrite(membership);
    const item = await load(membership, id);
    const body = await parseJson(req);

    const nextName = body.name ? String(body.name).trim().slice(0, 120) : item.name;
    if (nextName) item.name = nextName;
    if (body.amount != null) {
      const amountMinor = moneyField(body.amount, "amount", { positive: true });
      item.status = statusAfterAmountEdit("expense", amountMinor, paidTotal(item, "expense"), item.status);
      item.amountMinor = amountMinor;
    }
    const nextDate = body.dueDate ? ymd(body.dueDate, "due date") : item.dueDate;
    item.dueDate = nextDate;
    if (body.category != null) item.category = oneOf(body.category, EXPENSE_CATEGORIES, "expense category", item.category);
    const nextFrequency = body.frequency != null ? oneOf(body.frequency, FREQUENCIES, "frequency", item.frequency) : item.frequency;
    assertScheduleConversionAllowed("expense", item, nextFrequency);
    if (!item.scheduleId) {
      item.frequency = nextFrequency;
      if (nextFrequency !== "once") {
        item.occurrenceKey = undefined;
        item.scheduleId = null;
      }
    }
    if (body.essential != null) item.essential = !!body.essential;
    if (body.priority != null) item.priority = priorityField(body.priority, "priority");
    if (body.notes != null) item.notes = String(body.notes).slice(0, 500);

    const paymentChanged = body.pay != null || body.setPaid != null || body.removePayment != null;
    if (body.setPaid != null) {
      const total = moneyField(body.setPaid, "paid total");
      const date = body.paidDate ? ymd(body.paidDate, "paid date") : item.paidDate;
      setPaymentsTotal(item, "expense", total, date, body.note);
    } else if (body.pay != null) {
      const increment = moneyField(body.pay, "payment", { positive: true });
      const date = ymd(body.paidDate || item.dueDate, "paid date");
      addPayment(item, "expense", increment, date, body.note);
    } else if (body.removePayment != null) {
      removePayment(item, "expense", body.removePayment);
    }

    if (body.status && EXPENSE_STATUSES.includes(body.status) && !paymentChanged) {
      if (body.status === "paid" && item.paidMinor < item.amountMinor) {
        const err = new Error("Record the full payment before marking a bill paid. Due dates are not auto-paid.");
        err.status = 400;
        throw err;
      }
      if (body.status === "partial" && item.paidMinor <= 0) {
        const err = new Error("Record a payment before marking a bill partially paid.");
        err.status = 400;
        throw err;
      }
      item.status = body.status;
    }

    const key = nextOccurrenceKey("expense", String(membership.householdId), item, {
      name: item.name,
      date: item.dueDate,
      amountMinor: item.amountMinor,
      frequency: item.frequency,
    });
    if (key) {
      duplicateFilter = { householdId: membership.householdId, occurrenceKey: key, _id: { $ne: item._id } };
      const duplicate = await Expense.findOne(duplicateFilter).lean();
      if (duplicate) {
        const err = new Error("This bill already exists for that date.");
        err.status = 409;
        throw err;
      }
      item.occurrenceKey = key;
    }

    await item.save();
    if (item.scheduleId) {
      const update = {};
      if (body.name) update.name = item.name;
      if (body.amount != null) update.amountMinor = item.amountMinor;
      if (body.category != null) update.category = item.category;
      if (body.notes != null) update.notes = item.notes;
      if (body.essential != null) update.essential = item.essential;
      if (body.priority != null) update.priority = item.priority;
      if (Object.keys(update).length) {
        await Expense.updateOne({ _id: item.scheduleId, householdId: membership.householdId }, { $set: update });
        await Expense.updateMany(
          {
            householdId: membership.householdId,
            scheduleId: item.scheduleId,
            dueDate: { $gt: item.dueDate },
            paidMinor: 0,
          },
          { $set: update }
        );
      }
    }
    await audit(membership, session.user.id, "update", "expense", item._id);
    return json({ item });
  } catch (err) {
    if (err.code === 11000) {
      if (duplicateFilter) {
        const existing = await Expense.findOne(duplicateFilter).lean().catch(() => null);
        if (existing) return json({ error: "This bill already exists for that date." }, 409);
      }
      return json({ error: "This bill already exists for that date." }, 409);
    }
    return handle(err);
  }
}

export async function DELETE(_req, { params }) {
  try {
    const { id } = await params;
    const session = await requireSession();
    const membership = await requireMembership(session.user.id);
    assertWrite(membership);
    const item = await load(membership, id);
    let removed = 1;
    if (item.scheduleId) {
      // Deleting a single occurrence would be recreated by the next generation pass,
      // so a repeating bill is removed as a series. Already-paid rows are kept.
      await Expense.deleteOne({ _id: item.scheduleId, householdId: membership.householdId });
      const result = await Expense.deleteMany({
        householdId: membership.householdId,
        scheduleId: item.scheduleId,
        dueDate: { $gte: item.dueDate },
        paidMinor: 0,
      });
      removed = result.deletedCount;
    } else {
      await item.deleteOne();
    }
    await audit(membership, session.user.id, "delete", "expense", id);
    return json({ ok: true, removed });
  } catch (err) {
    return handle(err);
  }
}
