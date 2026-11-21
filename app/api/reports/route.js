import { runPlan } from "@/lib/engine/planningEngine";
import { loadPlanInput, defaultPeriod } from "@/lib/planContext";
import Household from "@/models/Household";
import { json, requireSession, requireMembership, handle, ymd } from "@/lib/api";
import { categoryBreakdown, overBudgetCategories } from "@/lib/reportCategories";

export async function GET(req) {
  try {
    const session = await requireSession();
    const membership = await requireMembership(session.user.id);
    const url = new URL(req.url);
    const household = await Household.findById(membership.householdId).lean();
    const fallback = defaultPeriod(household);
    const from = url.searchParams.get("from") ? ymd(url.searchParams.get("from")) : fallback.start;
    const to = url.searchParams.get("to") ? ymd(url.searchParams.get("to")) : fallback.end;
    const category = url.searchParams.get("category");
    const input = await loadPlanInput(membership.householdId, from, to);
    // loadPlanInput can return a shared cached object. Filtering in place would
    // poison /api/plan, /api/insights and later unfiltered reports.
    const reportInput = category
      ? { ...input, expenses: input.expenses.filter((e) => e.category === category) }
      : input;
    const plan = runPlan(reportInput);
    const byCategory = categoryBreakdown(reportInput.expenses, { start: from, end: to });
    const over = overBudgetCategories(byCategory);
    return json({
      period: { from, to },
      startingBalanceMinor: plan.startingBalanceMinor,
      confirmedIncomeMinor: plan.totals.confirmedIncomeMinor,
      expectedIncomeMinor: plan.totals.expectedIncomeLeftMinor,
      actualSpendMinor: plan.totals.actualSpendMinor,
      unpaidBillsMinor: plan.totals.unpaidBillsMinor,
      endingProjectedMinor: plan.totals.endingProjectedMinor,
      endingConfirmedMinor: plan.totals.endingConfirmedMinor,
      projectedSurplusMinor: plan.totals.projectedSurplusMinor,
      actualSavingsMinor: household.savingsBalanceMinor || 0,
      shortages: plan.shortages,
      overCategories: over,
      byCategory,
      assumptions: plan.assumptions,
    });
  } catch (err) {
    return handle(err);
  }
}
export const dynamic = "force-dynamic";
