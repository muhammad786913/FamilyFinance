import mongoose from "mongoose";
import SpecialEvent from "@/models/SpecialEvent";
import { json, requireSession, requireMembership, parseJson, assertWrite, handle, moneyField, ymd, audit } from "@/lib/api";

export async function PATCH(req, { params }) {
  try {
    const session = await requireSession();
    const membership = await requireMembership(session.user.id);
    assertWrite(membership);
    if (!mongoose.isValidObjectId(params.id)) return json({ error: "Not found" }, 404);
    const item = await SpecialEvent.findOne({ _id: params.id, householdId: membership.householdId });
    if (!item) return json({ error: "Not found" }, 404);
    const body = await parseJson(req);
    if (body.name) item.name = String(body.name).slice(0, 120);
    if (body.amount != null) item.amountMinor = moneyField(body.amount);
    if (body.targetDate) item.targetDate = ymd(body.targetDate);
    if (body.includeInPlan != null) item.includeInPlan = !!body.includeInPlan;
    if (body.notes != null) item.notes = String(body.notes).slice(0, 500);
    await item.save();
    await audit(membership, session.user.id, "update", "event", item._id);
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
    await SpecialEvent.deleteOne({ _id: params.id, householdId: membership.householdId });
    await audit(membership, session.user.id, "delete", "event", params.id);
    return json({ ok: true });
  } catch (err) {
    return handle(err);
  }
}
