import Goal from "@/models/Goal";
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

export async function GET() {
  try {
    const session = await requireSession();
    const membership = await requireMembership(session.user.id);
    const items = await Goal.find({ householdId: membership.householdId }).sort({ targetDate: 1 }).limit(100).lean();
    return json({ items });
  } catch (err) {
    return handle(err);
  }
}

export async function POST(req) {
  try {
    const session = await requireSession();
    const membership = await requireMembership(session.user.id);
    assertWrite(membership);
    const body = await parseJson(req);
    const name = String(body.name || "").trim().slice(0, 120);
    if (!name) return json({ error: "Name is required." }, 400);
    const item = await Goal.create({
      householdId: membership.householdId,
      name,
      targetMinor: moneyField(body.target, "target", { positive: true }),
      savedMinor: body.saved != null ? moneyField(body.saved, "saved") : 0,
      targetDate: ymd(body.targetDate, "target date"),
      priority: Math.min(9, Math.max(1, Number(body.priority) || 5)),
      contributionMinor: body.contribution != null ? moneyField(body.contribution, "contribution") : 0,
      notes: String(body.notes || "").slice(0, 500),
    });
    await audit(membership, session.user.id, "create", "goal", item._id);
    return json({ item }, 201);
  } catch (err) {
    return handle(err);
  }
}
export const dynamic = "force-dynamic";
