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
import { EXPENSE_STATUSES } from "@/lib/constants";

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
    const session = await requireSession();
    const membership = await requireMembership(session.user.id);
    assertWrite(membership);
    const item = await load(membership, params.id);
    const body = await parseJson(req);
    if (body.name) item.name = String(body.name).slice(0, 120);
    if (body.amount != null) item.amountMinor = moneyField(body.amount);
    if (body.dueDate) item.dueDate = ymd(body.dueDate);
    if (body.essential != null) item.essential = !!body.essential;
    if (body.priority != null) item.priority = Math.min(9, Math.max(1, Number(body.priority)));
    if (body.notes != null) item.notes = String(body.notes).slice(0, 500);
    if (body.pay != null) {
      const pay = moneyField(body.pay, "payment");
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
    await audit(membership, session.user.id, "update", "expense", item._id);
    return json({ item });
  } catch (err) {
    return handle(err);
  }
}

export async function DELETE(_req, { params }) {
  try {
    const session = await requireSession();
    const membership = await requireMembership(session.user.id);
    assertWrite(membership);
    const item = await load(membership, params.id);
    await item.deleteOne();
    await audit(membership, session.user.id, "delete", "expense", params.id);
    return json({ ok: true });
  } catch (err) {
    return handle(err);
  }
}
