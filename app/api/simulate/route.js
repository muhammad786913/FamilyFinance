import Scenario from "@/models/Scenario";
import Expense from "@/models/Expense";
import { applyScenario, comparePlans, runPlan } from "@/lib/engine/planningEngine";
import { loadPlanInput, defaultPeriod } from "@/lib/planContext";
import Household from "@/models/Household";
import { json, requireSession, requireMembership, parseJson, assertWrite, handle, audit } from "@/lib/api";
import scenarioPayload from "@/lib/scenarioPayload";

export async function GET() {
  try {
    const session = await requireSession();
    const membership = await requireMembership(session.user.id);
    const items = await Scenario.find({ householdId: membership.householdId }).sort({ createdAt: -1 }).limit(20).lean();
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
    const household = await Household.findById(membership.householdId).lean();
    const period = defaultPeriod(household);
    const input = await loadPlanInput(membership.householdId, period.start, period.end);
    let scenarioName = String(body.name || "Scenario").slice(0, 120);
    let payload;
    const existing = body.scenarioId
      ? await Scenario.findOne({ _id: body.scenarioId, householdId: membership.householdId }).lean()
      : null;
    if (body.scenarioId && !existing) return json({ error: "Scenario not found" }, 404);
    if (existing) {
      payload = existing.payload;
      scenarioName = existing.name;
    } else {
      payload = scenarioPayload.buildScenarioPayload(body, period);
    }
    const baseline = runPlan(input);
    const simulated = applyScenario(input, payload);
    const diff = comparePlans(baseline, simulated);
    let saved = null;
    if (body.save && !existing) {
      saved = await Scenario.create({
        householdId: membership.householdId,
        name: scenarioName,
        payload,
      });
      await audit(membership, session.user.id, "create", "scenario", saved._id);
    }
    if (body.apply && payload.extraExpense) {
      await Expense.create({
        householdId: membership.householdId,
        name: payload.extraExpense.name,
        amountMinor: payload.extraExpense.amountMinor,
        dueDate: payload.extraExpense.dueDate,
        originalDueDate: payload.extraExpense.dueDate,
        essential: payload.extraExpense.essential,
        priority: payload.extraExpense.priority,
        category: "other",
      });
      await audit(membership, session.user.id, "apply", "scenario", "extra-expense");
    }
    return json({ baseline, simulated, diff, saved });
  } catch (err) {
    return handle(err);
  }
}
export const dynamic = "force-dynamic";
