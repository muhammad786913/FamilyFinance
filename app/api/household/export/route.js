import Income from "@/models/Income";
import Expense from "@/models/Expense";
import Goal from "@/models/Goal";
import SpecialEvent from "@/models/SpecialEvent";
import Household from "@/models/Household";
import { json, requireSession, requireMembership, handle } from "@/lib/api";

export async function GET() {
  try {
    const session = await requireSession();
    const membership = await requireMembership(session.user.id);
    const hid = membership.householdId;
    const [household, incomes, expenses, goals, events] = await Promise.all([
      Household.findById(hid).lean(),
      Income.find({ householdId: hid }).lean(),
      Expense.find({ householdId: hid }).lean(),
      Goal.find({ householdId: hid }).lean(),
      SpecialEvent.find({ householdId: hid }).lean(),
    ]);
    return json({ exportedAt: new Date().toISOString(), household, incomes, expenses, goals, events });
  } catch (err) {
    return handle(err);
  }
}
