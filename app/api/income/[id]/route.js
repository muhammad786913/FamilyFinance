import mongoose from "mongoose";
import Income from "@/models/Income";
import Household from "@/models/Household";
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
} from "@/lib/api";
import { INCOME_CATEGORIES, FREQUENCIES, INCOME_STATUSES } from "@/lib/constants";
import { todayInZone } from "@/lib/dates";
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
  const item = await Income.findOne({ _id: id, householdId: membership.householdId });
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
    const nextDate = body.expectedDate ? ymd(body.expectedDate, "expected date") : item.expectedDate;
    let amountStatus = null;
    if (body.amount != null) {
      const amountMinor = moneyField(body.amount, "amount", { positive: true });
      amountStatus = statusAfterAmountEdit("income", amountMinor, paidTotal(item, "income"), item.status);
      item.amountMinor = amountMinor;
      item.status = amountStatus;
    }
    item.expectedDate = nextDate;
    if (body.category != null) item.category = oneOf(body.category, INCOME_CATEGORIES, "income category", item.category);
    const nextFrequency = body.frequency != null ? oneOf(body.frequency, FREQUENCIES, "frequency", item.frequency) : item.frequency;
    assertScheduleConversionAllowed("income", item, nextFrequency);
    if (!item.scheduleId) {
      item.frequency = nextFrequency;
      if (nextFrequency !== "once") {
        item.occurrenceKey = undefined;
        item.scheduleId = null;
      }
    }
    if (body.notes != null) item.notes = String(body.notes).slice(0, 500);
    if (body.estimated != null) item.estimated = !!body.estimated;

    const paymentChanged = body.receive != null || body.setReceived != null || body.removePayment != null;
    if (body.setReceived != null) {
      const total = moneyField(body.setReceived, "received total");
      const date = body.receivedDate ? ymd(body.receivedDate, "received date") : item.receivedDate;
      setPaymentsTotal(item, "income", total, date, body.note);
    } else if (body.receive != null) {
      const increment = moneyField(body.receive, "received amount", { positive: true });
      const date = ymd(body.receivedDate || body.expectedDate || item.expectedDate, "received date");
      addPayment(item, "income", increment, date, body.note);
    } else if (body.removePayment != null) {
      removePayment(item, "income", body.removePayment);
    }

    if (body.status && INCOME_STATUSES.includes(body.status) && !paymentChanged) {
      // A status is only a label. It must never turn projected money into
      // spendable cash without a real payment being recorded first.
      if (body.status === "received" && item.receivedMinor < item.amountMinor) {
        const err = new Error("Record the full amount received before marking this as Received.");
        err.status = 400;
        throw err;
      }
      if (body.status === "partial" && item.receivedMinor <= 0) {
        const err = new Error("Record a received amount before marking this as Partially received.");
        err.status = 400;
        throw err;
      }
      item.status = body.status;
      if (body.status === "received" && !item.receivedDate) {
        const household = await Household.findById(membership.householdId).select("timezone").lean();
        item.receivedDate = todayInZone(household?.timezone || "Asia/Karachi");
      }
    }

    // Editing a name, date or amount must not create a business-identical row.
    const key = nextOccurrenceKey("income", String(membership.householdId), item, {
      name: item.name,
      date: item.expectedDate,
      amountMinor: item.amountMinor,
      frequency: item.frequency,
    });
    if (key) {
      duplicateFilter = { householdId: membership.householdId, occurrenceKey: key, _id: { $ne: item._id } };
      const duplicate = await Income.findOne(duplicateFilter).lean();
      if (duplicate) {
        const err = new Error("This income entry already exists for that date.");
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
    if (err.code === 11000) {
      if (duplicateFilter) {
        const existing = await Income.findOne(duplicateFilter).lean().catch(() => null);
        if (existing) return json({ error: "This income entry already exists for that date." }, 409);
      }
      return json({ error: "This income entry already exists for that date." }, 409);
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
