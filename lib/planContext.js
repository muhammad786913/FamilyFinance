import Income from "@/models/Income";
import Expense from "@/models/Expense";
import Household from "@/models/Household";
import { generateOccurrences } from "@/lib/engine/recurring";
import { monthBounds, todayInZone } from "@/lib/dates";
import { cacheGet, cacheSet } from "@/lib/cache";

export async function ensureOccurrences(householdId, start, end) {
  const [incomes, expenses] = await Promise.all([
    Income.find({ householdId, frequency: { $ne: "once" }, scheduleId: null }).lean(),
    Expense.find({ householdId, frequency: { $ne: "once" }, scheduleId: null }).lean(),
  ]);

  const incomeOps = [];
  for (const src of incomes) {
    const schedule = { id: String(src._id), frequency: src.frequency, anchorDate: src.expectedDate, endDate: null };
    for (const occ of generateOccurrences(schedule, start, end)) {
      incomeOps.push({
        updateOne: {
          filter: { householdId, occurrenceKey: occ.occurrenceKey },
          update: {
            $setOnInsert: {
              householdId,
              scheduleId: String(src._id),
              occurrenceKey: occ.occurrenceKey,
              name: src.name,
              category: src.category,
              amountMinor: src.amountMinor,
              receivedMinor: 0,
              expectedDate: occ.date,
              frequency: "once",
              status: "expected",
              estimated: src.estimated,
              notes: src.notes,
            },
          },
          upsert: true,
        },
      });
    }
  }
  const expenseOps = [];
  for (const src of expenses) {
    const schedule = { id: String(src._id), frequency: src.frequency, anchorDate: src.dueDate, endDate: null };
    for (const occ of generateOccurrences(schedule, start, end)) {
      expenseOps.push({
        updateOne: {
          filter: { householdId, occurrenceKey: occ.occurrenceKey },
          update: {
            $setOnInsert: {
              householdId,
              scheduleId: String(src._id),
              occurrenceKey: occ.occurrenceKey,
              name: src.name,
              category: src.category,
              amountMinor: src.amountMinor,
              paidMinor: 0,
              dueDate: occ.date,
              originalDueDate: occ.date,
              frequency: "once",
              status: "unpaid",
              essential: src.essential,
              priority: src.priority,
              notes: src.notes,
            },
          },
          upsert: true,
        },
      });
    }
  }
  if (incomeOps.length) await Income.bulkWrite(incomeOps, { ordered: false });
  if (expenseOps.length) await Expense.bulkWrite(expenseOps, { ordered: false });
}

function mapIncome(doc) {
  return {
    id: String(doc._id),
    name: doc.name,
    category: doc.category,
    amountMinor: doc.amountMinor,
    receivedMinor: doc.receivedMinor,
    expectedDate: doc.expectedDate,
    receivedDate: doc.receivedDate,
    status: doc.status,
    estimated: doc.estimated,
  };
}

function mapExpense(doc) {
  return {
    id: String(doc._id),
    name: doc.name,
    category: doc.category,
    amountMinor: doc.amountMinor,
    paidMinor: doc.paidMinor,
    dueDate: doc.dueDate,
    paidDate: doc.paidDate,
    status: doc.status,
    essential: doc.essential,
    priority: doc.priority,
  };
}

export async function loadPlanInput(householdId, from, to) {
  const cacheKey = `${householdId}:plan:${from}:${to}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;
  await ensureOccurrences(householdId, from, to);
  const period = {
    $or: [
      { frequency: "once", scheduleId: null },
      { occurrenceKey: { $ne: null } },
    ],
  };
  const [household, incomes, expenses] = await Promise.all([
    Household.findById(householdId).lean(),
    Income.find({
      householdId,
      ...period,
      $and: [
        {
          $or: [{ expectedDate: { $gte: from, $lte: to } }, { receivedDate: { $gte: from, $lte: to } }],
        },
      ],
    })
      .select("name category amountMinor receivedMinor expectedDate receivedDate status estimated")
      .lean(),
    Expense.find({
      householdId,
      ...period,
      $and: [
        {
          $or: [{ dueDate: { $gte: from, $lte: to } }, { paidDate: { $gte: from, $lte: to } }],
        },
      ],
    })
      .select("name category amountMinor paidMinor dueDate paidDate status essential priority")
      .lean(),
  ]);
  const input = {
    startDate: from,
    endDate: to,
    asOfDate: todayInZone(household.timezone),
    startingBalanceMinor: household.startingBalanceMinor || 0,
    emergencyReserveMinor: household.emergencyReserveMinor || 0,
    weekStartsOn: household.weekStartsOn ?? 1,
    incomes: incomes.map(mapIncome),
    expenses: expenses.map(mapExpense),
    household,
  };
  cacheSet(cacheKey, input, 10_000);
  return input;
}

export function defaultPeriod(household) {
  const today = todayInZone(household.timezone || "Asia/Karachi");
  return monthBounds(today, household.planningStartDay || 1);
}
