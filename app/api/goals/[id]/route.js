import mongoose from "mongoose";
import Goal from "@/models/Goal";
import { json, requireSession, requireMembership, parseJson, assertWrite, handle, moneyField, ymd, audit } from "@/lib/api";

export async function PATCH(req, { params }) {
  try {
    const session = await requireSession();
    const membership = await requireMembership(session.user.id);
    assertWrite(membership);
    if (!mongoose.isValidObjectId(params.id)) return json({ error: "Not found" }, 404);
    const item = await Goal.findOne({ _id: params.id, householdId: membership.householdId });
    if (!item) return json({ error: "Not found" }, 404);
    const body = await parseJson(req);
    if (body.name) item.name = String(body.name).slice(0, 120);
    if (body.target != null) item.targetMinor = moneyField(body.target);
    if (body.saved != null) item.savedMinor = moneyField(body.saved);
    if (body.targetDate) item.targetDate = ymd(body.targetDate);
    if (body.contribution != null) item.contributionMinor = moneyField(body.contribution);
    if (body.notes != null) item.notes = String(body.notes).slice(0, 500);
    await item.save();
    await audit(membership, session.user.id, "update", "goal", item._id);
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
    await Goal.deleteOne({ _id: params.id, householdId: membership.householdId });
    await audit(membership, session.user.id, "delete", "goal", params.id);
    return json({ ok: true });
  } catch (err) {
    return handle(err);
  }
}
