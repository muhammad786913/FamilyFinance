import { runPlan } from "@/lib/engine/planningEngine";
import { loadPlanInput, defaultPeriod } from "@/lib/planContext";
import { json, requireSession, requireMembership, handle, ymd } from "@/lib/api";
import Household from "@/models/Household";
import { survivalBudget } from "@/lib/engine/survivalBudget";
import { todayInZone } from "@/lib/dates";

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
    const survival = survivalBudget({
      householdSize: Math.max(1, household.members?.length || 1),
      location: household.city || "Other",
      asOfDate: todayInZone(household.timezone),
      housingMinor: household.survival?.housingMinor,
      foodMinor: household.survival?.foodMinor,
      utilitiesMinor: household.survival?.utilitiesMinor,
      transportMinor: household.survival?.transportMinor,
      medicalMinor: household.survival?.medicalMinor,
      educationMinor: household.survival?.educationMinor,
      otherEssentialMinor: household.survival?.otherEssentialMinor,
      useLocationEstimates: household.survival?.useLocationEstimates,
      confirmedIncomeMinor: plan.totals.confirmedIncomeMinor,
      expectedIncomeMinor: plan.totals.expectedIncomeLeftMinor,
    });
    return json({ plan, survival, period: { from, to } });
  } catch (err) {
    return handle(err);
  }
}
