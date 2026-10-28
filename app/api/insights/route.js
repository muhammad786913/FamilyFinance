import Household from "@/models/Household";
import { runPlan } from "@/lib/engine/planningEngine";
import { loadPlanInput, defaultPeriod, survivalFor } from "@/lib/planContext";
import { addMonthsClamped, monthBounds, todayInZone } from "@/lib/dates";
import { healthScore, buildAgenda, runwayDays } from "@/lib/insights";
import { json, requireSession, requireMembership, handle, ymd } from "@/lib/api";

export async function GET(req) {
  try {
    const session = await requireSession();
    const membership = await requireMembership(session.user.id);
    const household = await Household.findById(membership.householdId).lean();
    const url = new URL(req.url);
    const fallback = defaultPeriod(household);
    const from = url.searchParams.get("from") ? ymd(url.searchParams.get("from")) : fallback.start;
    const to = url.searchParams.get("to") ? ymd(url.searchParams.get("to")) : fallback.end;
    const today = todayInZone(household.timezone || "Asia/Karachi");

    const input = await loadPlanInput(membership.householdId, from, to);
    const plan = runPlan(input);
    const survival = survivalFor(household, plan);
    const health = healthScore({ plan, household });
    const agenda = buildAgenda(plan, today, 14);
    const runway = runwayDays(plan, today);
    const todayRow = plan.daily.find((d) => d.date === today) || plan.daily[0] || null;

    const trend = [];
    for (let offset = -5; offset <= 0; offset += 1) {
      const bounds = monthBounds(addMonthsClamped(fallback.start, offset), household.planningStartDay || 1);
      const past = runPlan(await loadPlanInput(membership.householdId, bounds.start, bounds.end));
      trend.push({
        from: bounds.start,
        to: bounds.end,
        label: bounds.start.slice(0, 7),
        incomeMinor: past.totals.confirmedIncomeMinor,
        expectedIncomeMinor: past.totals.expectedIncomeLeftMinor,
        spendMinor: past.totals.actualSpendMinor,
        unpaidMinor: past.totals.unpaidBillsMinor,
        endingProjectedMinor: past.totals.endingProjectedMinor,
        shortages: past.shortages.length,
      });
    }

    const categories = {};
    for (const exp of input.expenses) {
      const row = categories[exp.category] || { planned: 0, paid: 0 };
      row.planned += exp.amountMinor;
      row.paid += exp.paidMinor || 0;
      categories[exp.category] = row;
    }

    return json({
      period: { from, to },
      today,
      plan,
      survival,
      health,
      agenda,
      runway,
      todayRow,
      trend,
      categories,
    });
  } catch (err) {
    return handle(err);
  }
}

export const dynamic = "force-dynamic";
