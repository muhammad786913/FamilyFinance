import mongoose from "mongoose";
import Scenario from "@/models/Scenario";
import { json, requireSession, requireMembership, assertWrite, handle, audit } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function DELETE(_req, { params }) {
  try {
    const { id } = await params;
    const session = await requireSession();
    const membership = await requireMembership(session.user.id);
    assertWrite(membership);
    if (!mongoose.isValidObjectId(id)) return json({ error: "Not found" }, 404);
    const item = await Scenario.findOneAndDelete({ _id: id, householdId: membership.householdId });
    if (!item) return json({ error: "Not found" }, 404);
    await audit(membership, session.user.id, "delete", "scenario", id);
    return json({ ok: true });
  } catch (err) {
    return handle(err);
  }
}
