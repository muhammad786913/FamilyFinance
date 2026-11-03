import Household from "@/models/Household";
import DailyCheckin from "@/models/DailyCheckin";
import { runPlan } from "@/lib/engine/planningEngine";
import { loadPlanInput } from "@/lib/planContext";
import { addDays, monthBounds, todayInZone } from "@/lib/dates";
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

const MAX_BACKFILL_DAYS = 30;

async function householdToday(householdId) {
  const household = await Household.findById(householdId).lean();
  return {
    household,
    today: todayInZone(household?.timezone || "Asia/Karachi"),
  };
}

/** Safe-to-spend amount for a specific day, from the cycle that contains it. */
async function budgetForDay(membership, household, date) {
  const bounds = monthBounds(date, household?.planningStartDay || 1);
  const plan = runPlan(await loadPlanInput(membership.householdId, bounds.start, bounds.end));
  const row = plan.daily.find((day) => day.date === date);
  const suggested = Number(row?.suggestedDiscretionaryMinor);
  return Number.isSafeInteger(suggested) && suggested > 0 ? suggested : 0;
}

export async function GET(req) {
  try {
    const session = await requireSession();
    const membership = await requireMembership(session.user.id);
    const url = new URL(req.url);
    const days = Math.min(31, Math.max(1, Math.floor(Number(url.searchParams.get("days") || 14)) || 14));
    const { today } = await householdToday(membership.householdId);
    const from = addDays(today, -(days - 1));
    const items = await DailyCheckin.find({
      householdId: membership.householdId,
      date: { $gte: from, $lte: today },
    })
      .sort({ date: 1 })
      .lean();
    return json({ items, today });
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
    const { household, today } = await householdToday(membership.householdId);
    const date = body.date ? ymd(body.date, "date") : today;
    const oldest = addDays(today, -MAX_BACKFILL_DAYS);
    if (date > today) return json({ error: "You cannot log spending for a future date." }, 400);
    if (date < oldest) return json({ error: `You can log spending for the last ${MAX_BACKFILL_DAYS + 1} days.` }, 400);

    const budgetMinor = await budgetForDay(membership, household, date);
    const item = await DailyCheckin.findOneAndUpdate(
      { householdId: membership.householdId, date },
      {
        $set: {
          budgetMinor,
          spentMinor: moneyField(body.spent ?? 0, "spent amount"),
          note: String(body.note || "").slice(0, 200),
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
    ).lean();
    await audit(membership, session.user.id, "update", "daily-checkin", item._id);
    return json({ item, today });
  } catch (err) {
    return handle(err);
  }
}

export const dynamic = "force-dynamic";
