import Household from "@/models/Household";
import { survivalBudget } from "@/lib/engine/survivalBudget";
import { runPlan } from "@/lib/engine/planningEngine";
import { loadPlanInput, defaultPeriod } from "@/lib/planContext";
import { json, requireSession, requireMembership, parseJson, assertWrite, handle, moneyField } from "@/lib/api";
import { todayInZone } from "@/lib/dates";

export async function GET() {
  try {
    const session = await requireSession();
    const membership = await requireMembership(session.user.id);
    const household = await Household.findById(membership.householdId).lean();
    const period = defaultPeriod(household);
    const input = await loadPlanInput(membership.householdId, period.start, period.end);
    const plan = runPlan(input);
    const result = survivalBudget({
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
    return json({ result, planShortages: plan.shortages, missedEssentials: plan.missedEssentials });
  } catch (err) {
    return handle(err);
  }
}

export async function PUT(req) {
  try {
    const session = await requireSession();
    const membership = await requireMembership(session.user.id);
    assertWrite(membership);
    const body = await parseJson(req);
    const survival = {
      housingMinor: body.housing != null ? moneyField(body.housing) : 0,
      foodMinor: body.food != null ? moneyField(body.food) : 0,
      utilitiesMinor: body.utilities != null ? moneyField(body.utilities) : 0,
      transportMinor: body.transport != null ? moneyField(body.transport) : 0,
      medicalMinor: body.medical != null ? moneyField(body.medical) : 0,
      educationMinor: body.education != null ? moneyField(body.education) : 0,
      otherEssentialMinor: body.other != null ? moneyField(body.other) : 0,
      useLocationEstimates: !!body.useLocationEstimates,
    };
    const $set = { survival };
    if (body.city) $set.city = String(body.city).slice(0, 80);
    if (Array.isArray(body.members)) {
      $set.members = body.members.slice(0, 20).map((m) => ({
        label: String(m.label || "Member").slice(0, 40),
        ageGroup: m.ageGroup || "unspecified",
      }));
    }
    await Household.updateOne({ _id: membership.householdId }, { $set });
    return GET();
  } catch (err) {
    return handle(err);
  }
}
export const dynamic = "force-dynamic";
