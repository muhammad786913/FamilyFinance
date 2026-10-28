import SpecialEvent from "@/models/SpecialEvent";
import { eventAffordability } from "@/lib/engine/planningEngine";
import { loadPlanInput, defaultPeriod } from "@/lib/planContext";
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
import Household from "@/models/Household";
import { EVENT_KINDS } from "@/lib/constants";

export async function GET() {
  try {
    const session = await requireSession();
    const membership = await requireMembership(session.user.id);
    const household = await Household.findById(membership.householdId).lean();
    const period = defaultPeriod(household);
    const input = await loadPlanInput(membership.householdId, period.start, period.end);
    const items = await SpecialEvent.find({ householdId: membership.householdId }).sort({ targetDate: 1 }).limit(100).lean();
    const withVerdict = items.map((ev) => {
      const result = eventAffordability(input, {
        name: ev.name,
        amountMinor: ev.amountMinor,
        targetDate: ev.targetDate,
      });
      return { ...ev, verdict: result.verdict };
    });
    return json({ items: withVerdict });
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
    const item = await SpecialEvent.create({
      householdId: membership.householdId,
      name,
      kind: oneOf(body.kind, EVENT_KINDS, "event type", "other"),
      amountMinor: moneyField(body.amount, "amount", { positive: true }),
      targetDate: ymd(body.targetDate, "target date"),
      priority: Math.min(9, Math.max(1, Number(body.priority) || 5)),
      notes: String(body.notes || "").slice(0, 500),
      includeInPlan: !!body.includeInPlan,
    });
    await audit(membership, session.user.id, "create", "event", item._id);
    return json({ item }, 201);
  } catch (err) {
    return handle(err);
  }
}
export const dynamic = "force-dynamic";
