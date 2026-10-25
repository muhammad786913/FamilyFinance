import Scenario from "@/models/Scenario";
import Expense from "@/models/Expense";
import { applyScenario, comparePlans, runPlan } from "@/lib/engine/planningEngine";
import { loadPlanInput, defaultPeriod } from "@/lib/planContext";
import Household from "@/models/Household";
import { json, requireSession, requireMembership, parseJson, assertWrite, handle, moneyField, ymd, audit } from "@/lib/api";

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
    const payload = {
      delayIncomeId: body.delayIncomeId || null,
      delayDays: Number(body.delayDays) || 0,
      incomeAmountId: body.incomeAmountId || null,
      incomeAmountMinor: body.incomeAmount != null ? moneyField(body.incomeAmount) : null,
      expenseCategory: body.expenseCategory || null,
      expenseMultiplier: body.expenseMultiplier ? Number(body.expenseMultiplier) : null,
      extraExpense: body.extraAmount
        ? {
            id: "sim-extra",
            name: body.extraName || "Unexpected expense",
            amountMinor: moneyField(body.extraAmount),
            dueDate: ymd(body.extraDate || period.start),
            essential: !!body.extraEssential,
            priority: 3,
          }
        : null,
    };
    const baseline = runPlan(input);
    const simulated = applyScenario(input, payload);
    const diff = comparePlans(baseline, simulated);
    let saved = null;
    if (body.save) {
      saved = await Scenario.create({
        householdId: membership.householdId,
        name: String(body.name || "Scenario").slice(0, 120),
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
