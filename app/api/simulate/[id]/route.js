import mongoose from "mongoose";
import Scenario from "@/models/Scenario";
import { json, requireSession, requireMembership, assertWrite, handle, audit } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function DELETE(_req, { params }) {
  try {
    const session = await requireSession();
    const membership = await requireMembership(session.user.id);
    assertWrite(membership);
    if (!mongoose.isValidObjectId(params.id)) return json({ error: "Not found" }, 404);
    const item = await Scenario.findOneAndDelete({ _id: params.id, householdId: membership.householdId });
    if (!item) return json({ error: "Not found" }, 404);
    await audit(membership, session.user.id, "delete", "scenario", params.id);
    return json({ ok: true });
  } catch (err) {
    return handle(err);
  }
}
