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
  addMinorField,
  ymd,
  audit,
} from "@/lib/api";
import { INCOME_CATEGORIES, FREQUENCIES, INCOME_STATUSES } from "@/lib/constants";

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
    const { id } = await params;
    const session = await requireSession();
    const membership = await requireMembership(session.user.id);
    assertWrite(membership);
    const item = await load(membership, id);
    const body = await parseJson(req);
    if (body.name) item.name = String(body.name).slice(0, 120);
    if (body.amount != null) item.amountMinor = moneyField(body.amount, "amount", { positive: true });
    if (body.expectedDate) item.expectedDate = ymd(body.expectedDate);
    if (body.category && INCOME_CATEGORIES.includes(body.category)) item.category = body.category;
    if (body.frequency && FREQUENCIES.includes(body.frequency) && body.frequency !== "once" && !item.scheduleId) {
      item.frequency = body.frequency;
      item.occurrenceKey = undefined;
      item.scheduleId = null;
    }
    if (body.notes != null) item.notes = String(body.notes).slice(0, 500);
    if (body.estimated != null) item.estimated = !!body.estimated;
    if (body.receive != null) {
      const pay = moneyField(body.receive, "received amount", { positive: true });
      const date = ymd(body.receivedDate || body.expectedDate || item.expectedDate, "received date");
      const receivedTotal = addMinorField(item.receivedMinor ?? 0, pay, "received amount");
      item.payments.push({ amountMinor: pay, date, note: String(body.note || "") });
      item.receivedMinor = receivedTotal;
      item.receivedDate = date;
      if (item.receivedMinor >= item.amountMinor) item.status = "received";
      else item.status = "partial";
    }
    if (body.status && INCOME_STATUSES.includes(body.status) && body.receive == null) {
      item.status = body.status;
    }
    await item.save();
    if (item.scheduleId) {
      const update = {};
      if (body.name) update.name = item.name;
      if (body.amount != null) update.amountMinor = item.amountMinor;
      if (body.category) update.category = item.category;
      if (body.notes != null) update.notes = item.notes;
      if (body.estimated != null) update.estimated = item.estimated;
      if (Object.keys(update).length) {
        await Income.updateOne({ _id: item.scheduleId, householdId: membership.householdId }, { $set: update });
        await Income.updateMany(
          {
            householdId: membership.householdId,
            scheduleId: item.scheduleId,
            expectedDate: { $gt: item.expectedDate },
            receivedMinor: 0,
          },
          { $set: update }
        );
      }
    }
    await audit(membership, session.user.id, "update", "income", item._id);
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
      // Deleting one occurrence of a repeating schedule would be undone by the next
      // generation pass, so the whole series is removed. Received history is kept.
      await Income.deleteOne({ _id: item.scheduleId, householdId: membership.householdId });
      const result = await Income.deleteMany({
        householdId: membership.householdId,
        scheduleId: item.scheduleId,
        expectedDate: { $gte: item.expectedDate },
        receivedMinor: 0,
      });
      removed = result.deletedCount;
    } else {
      await item.deleteOne();
    }
    await audit(membership, session.user.id, "delete", "income", id);
    return json({ ok: true, removed });
  } catch (err) {
    return handle(err);
  }
}
