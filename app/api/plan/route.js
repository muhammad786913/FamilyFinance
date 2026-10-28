import { runPlan } from "@/lib/engine/planningEngine";
import { loadPlanInput, defaultPeriod, survivalFor } from "@/lib/planContext";
import { json, requireSession, requireMembership, handle, ymd } from "@/lib/api";
import Household from "@/models/Household";

export async function GET(req) {
  try {
    const session = await requireSession();
    const membership = await requireMembership(session.user.id);
    const url = new URL(req.url);
    const household = await Household.findById(membership.householdId).lean();
    const fallback = defaultPeriod(household);
    const from = url.searchParams.get("from") ? ymd(url.searchParams.get("from")) : fallback.start;
    const to = url.searchParams.get("to") ? ymd(url.searchParams.get("to")) : fallback.end;
    const input = await loadPlanInput(membership.householdId, from, to);
    const plan = runPlan(input);
    const survival = survivalFor(household, plan);
    return json({ plan, survival, period: { from, to } });
  } catch (err) {
    return handle(err);
  }
}
export const dynamic = "force-dynamic";
