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
} from "@/lib/api";
import { EXPENSE_CATEGORIES, FREQUENCIES, EXPENSE_STATUSES } from "@/lib/constants";

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
  try {
    const { id } = await params;
    const session = await requireSession();
    const membership = await requireMembership(session.user.id);
    assertWrite(membership);
    const item = await load(membership, id);
    const body = await parseJson(req);
    if (body.name) item.name = String(body.name).slice(0, 120);
    if (body.amount != null) item.amountMinor = moneyField(body.amount, "amount", { positive: true });
    if (body.dueDate) item.dueDate = ymd(body.dueDate);
    if (body.category && EXPENSE_CATEGORIES.includes(body.category)) item.category = body.category;
    if (body.frequency && FREQUENCIES.includes(body.frequency) && body.frequency !== "once" && !item.scheduleId) {
      item.frequency = body.frequency;
      item.occurrenceKey = undefined;
      item.scheduleId = null;
    }
    if (body.essential != null) item.essential = !!body.essential;
    if (body.priority != null) item.priority = Math.min(9, Math.max(1, Number(body.priority)));
    if (body.notes != null) item.notes = String(body.notes).slice(0, 500);
    if (body.pay != null) {
      const pay = moneyField(body.pay, "payment", { positive: true });
      const date = ymd(body.paidDate || item.dueDate, "paid date");
      item.payments.push({ amountMinor: pay, date, note: String(body.note || "") });
      item.paidMinor += pay;
      item.paidDate = date;
      if (item.paidMinor >= item.amountMinor) item.status = "paid";
      else item.status = "partial";
    }
    if (body.status && EXPENSE_STATUSES.includes(body.status) && body.pay == null) {
      if (body.status === "paid" && item.paidMinor <= 0) {
        return json({ error: "Record a payment before marking a bill paid. Due dates are not auto-paid." }, 400);
      }
      item.status = body.status;
    }
    await item.save();
    if (item.scheduleId) {
      const update = {};
      if (body.name) update.name = item.name;
      if (body.amount != null) update.amountMinor = item.amountMinor;
      if (body.category) update.category = item.category;
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
