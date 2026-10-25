import mongoose from "mongoose";
import Income from "@/models/Income";
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
import { INCOME_STATUSES } from "@/lib/constants";

async function load(membership, id) {
  if (!mongoose.isValidObjectId(id)) {
    const err = new Error("Not found");
    err.status = 404;
    throw err;
  }
  const item = await Income.findOne({ _id: id, householdId: membership.householdId });
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
    if (body.expectedDate) item.expectedDate = ymd(body.expectedDate);
    if (body.notes != null) item.notes = String(body.notes).slice(0, 500);
    if (body.estimated != null) item.estimated = !!body.estimated;
    if (body.receive != null) {
      const pay = moneyField(body.receive, "received amount");
      const date = ymd(body.receivedDate || body.expectedDate || item.expectedDate, "received date");
      item.payments.push({ amountMinor: pay, date, note: String(body.note || "") });
      item.receivedMinor += pay;
      item.receivedDate = date;
      if (item.receivedMinor >= item.amountMinor) item.status = "received";
      else item.status = "partial";
    }
    if (body.status && INCOME_STATUSES.includes(body.status) && body.receive == null) {
      item.status = body.status;
    }
    await item.save();
    await audit(membership, session.user.id, "update", "income", item._id);
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
    await audit(membership, session.user.id, "delete", "income", params.id);
    return json({ ok: true });
  } catch (err) {
    return handle(err);
  }
}
