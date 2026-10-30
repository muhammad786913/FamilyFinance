import Income from "@/models/Income";
import Expense from "@/models/Expense";
import Goal from "@/models/Goal";
import SpecialEvent from "@/models/SpecialEvent";
import Household from "@/models/Household";
import { addDays, monthBounds, todayInZone } from "@/lib/dates";
import { defaultPeriod } from "@/lib/planContext";
import { occurrenceKey } from "@/lib/engine/recurring";
import { json, requireSession, requireMembership, assertWrite, handle, audit } from "@/lib/api";

const INCOME = [
  ["Salary", "salary", 85000, 5],
  ["Spouse tuition income", "freelance", 18000, 15],
  ["Weekend shop work", "weekly_wage", 12000, 22],
  ["Flat rent received", "business", 20000, 1],
  ["Family contribution", "household_contribution", 15000, 10],
  ["Online course sales", "freelance", 7000, 27],
];

// name, category, amount, day-of-cycle, essential, priority, partially-paid amount
const BILLS = [
  ["House rent", "rent_housing", 30000, 3, true, 1],
  ["Electricity bill", "electricity_gas_water", 8500, 8, true, 2],
  ["Sui gas bill", "electricity_gas_water", 2600, 9, true, 2],
  ["Water tanker", "electricity_gas_water", 1800, 11, true, 2],
  ["Internet", "internet_phone", 3500, 10, false, 4],
  ["Mobile balance", "internet_phone", 1200, 14, false, 5],
  ["Streaming subscription", "entertainment", 900, 13, false, 6],
  ["Groceries (first half)", "groceries", 14000, 6, true, 1],
  ["Groceries (second half)", "groceries", 14000, 20, true, 1],
  ["School fee", "education", 9000, 7, true, 2],
  ["School van", "transport", 6000, 12, true, 3],
  ["Petrol", "transport", 7500, 16, true, 3],
  ["Medicine", "medical", 4000, 18, true, 2],
  ["Hospital visit", "medical", 12000, 26, true, 1, 5000],
  ["Family loan instalment", "debt", 5000, 25, true, 2],
  ["Clothing", "clothing", 4000, 24, false, 5],
  ["Life insurance", "other", 4500, 17, true, 2],
  ["Zakat and charity", "family_support", 3000, 28, false, 4],
  ["Home maintenance", "rent_housing", 2500, 21, false, 4, 1000],
];

function cycles(household) {
  const first = defaultPeriod(household);
  const second = monthBounds(addDays(first.start, 32), household.planningStartDay || 1);
  return [first, second];
}

export async function POST() {
  try {
    const session = await requireSession();
    const membership = await requireMembership(session.user.id);
    assertWrite(membership);
    const household = await Household.findById(membership.householdId).lean();
    if (household.demoSeededAt) {
      return json({ error: "Example data is already loaded. Remove it first, then add it again." }, 409);
    }
    const today = todayInZone(household.timezone || "Asia/Karachi");
    const hid = membership.householdId;
    const incomes = [];
    const expenses = [];

    for (const cycle of cycles(household)) {
      for (const [name, category, amount, day] of INCOME) {
        const date = addDays(cycle.start, day - 1);
        const received = date <= today;
        incomes.push({
          householdId: hid,
          isDemo: true,
          occurrenceKey: occurrenceKey(`demo-i-${hid}-${name}-${date}`, date),
          name,
          category,
          amountMinor: amount * 100,
          receivedMinor: received ? amount * 100 : 0,
          expectedDate: date,
          receivedDate: received ? date : null,
          frequency: "once",
          status: received ? "received" : "expected",
          estimated: !received,
          notes: "Example data",
          payments: received ? [{ amountMinor: amount * 100, date, note: "Example payment" }] : [],
        });
      }
      for (const [name, category, amount, day, essential, priority, partPaid] of BILLS) {
        const date = addDays(cycle.start, day - 1);
        const done = date <= today;
        const paidAmount = !done ? 0 : partPaid ?? amount;
        const status = !done ? "unpaid" : paidAmount >= amount ? "paid" : "partial";
        expenses.push({
          householdId: hid,
          isDemo: true,
          occurrenceKey: occurrenceKey(`demo-e-${hid}-${name}-${date}`, date),
          name,
          category,
          amountMinor: amount * 100,
          paidMinor: paidAmount * 100,
          dueDate: date,
          originalDueDate: date,
          paidDate: done ? date : null,
          frequency: "once",
          status,
          essential,
          priority,
          notes: "Example data",
          payments: done && paidAmount > 0 ? [{ amountMinor: paidAmount * 100, date, note: "Example payment" }] : [],
        });
      }
    }

    await Income.insertMany(incomes, { ordered: false });
    await Expense.insertMany(expenses, { ordered: false });

    const existingGoals = await Goal.countDocuments({ householdId: hid });
    if (!existingGoals) {
      await Goal.insertMany([
        {
          householdId: hid,
          isDemo: true,
          name: "Emergency fund",
          targetMinor: 300000 * 100,
          savedMinor: 65000 * 100,
          targetDate: addDays(today, 240),
          priority: 1,
          contributionMinor: 8000 * 100,
          notes: "Example goal: six months of essential costs.",
        },
        {
          householdId: hid,
          isDemo: true,
          name: "School admission",
          targetMinor: 60000 * 100,
          savedMinor: 12000 * 100,
          targetDate: addDays(today, 95),
          priority: 2,
          contributionMinor: 6000 * 100,
          notes: "Example goal",
        },
        {
          householdId: hid,
          isDemo: true,
          name: "Motorbike",
          targetMinor: 280000 * 100,
          savedMinor: 25000 * 100,
          targetDate: addDays(today, 400),
          priority: 4,
          contributionMinor: 5000 * 100,
          notes: "Example goal",
        },
        {
          householdId: hid,
          isDemo: true,
          name: "Hajj savings",
          targetMinor: 900000 * 100,
          savedMinor: 120000 * 100,
          targetDate: addDays(today, 900),
          priority: 3,
          contributionMinor: 10000 * 100,
          notes: "Example goal: long-term family target.",
        },
        {
          householdId: hid,
          isDemo: true,
          name: "Laptop for the children",
          targetMinor: 140000 * 100,
          savedMinor: 30000 * 100,
          targetDate: addDays(today, 150),
          priority: 2,
          contributionMinor: 4500 * 100,
          notes: "Example goal",
        },
      ]);
    }

    const existingEvents = await SpecialEvent.countDocuments({ householdId: hid });
    if (!existingEvents) {
      await SpecialEvent.insertMany([
        {
          householdId: hid,
          isDemo: true,
          name: "Cousin's wedding",
          kind: "wedding",
          amountMinor: 80000 * 100,
          targetDate: addDays(today, 45),
          priority: 2,
          notes: "Example event",
        },
        {
          householdId: hid,
          isDemo: true,
          name: "Eid shopping",
          kind: "eid",
          amountMinor: 45000 * 100,
          targetDate: addDays(today, 70),
          priority: 3,
          notes: "Example event",
        },
        {
          householdId: hid,
          isDemo: true,
          name: "New refrigerator",
          kind: "appliance",
          amountMinor: 95000 * 100,
          targetDate: addDays(today, 30),
          priority: 4,
          notes: "Example event",
        },
        {
          householdId: hid,
          isDemo: true,
          name: "School trip",
          kind: "other",
          amountMinor: 15000 * 100,
          targetDate: addDays(today, 18),
          priority: 2,
          notes: "Example event",
        },
        {
          householdId: hid,
          isDemo: true,
          name: "Car repair",
          kind: "other",
          amountMinor: 35000 * 100,
          targetDate: addDays(today, 12),
          priority: 1,
          notes: "Example event: a known expense in the next two weeks.",
        },
      ]);
    }

    const $set = { demoSeededAt: new Date() };
    const applied = {};
    if (!household.startingBalanceMinor) {
      $set.startingBalanceMinor = 45000 * 100;
      applied.startingBalanceMinor = $set.startingBalanceMinor;
    }
    if (!household.emergencyReserveMinor) {
      $set.emergencyReserveMinor = 6000 * 100;
      applied.emergencyReserveMinor = $set.emergencyReserveMinor;
    }
    if (!household.savingsBalanceMinor) {
      $set.savingsBalanceMinor = 25000 * 100;
      applied.savingsBalanceMinor = $set.savingsBalanceMinor;
    }
    if (!household.members?.length) {
      $set.members = [
        { label: "You", ageGroup: "adult" },
        { label: "Spouse", ageGroup: "adult" },
        { label: "Child 1", ageGroup: "child" },
        { label: "Child 2", ageGroup: "child" },
      ];
      applied.members = $set.members;
    }
    if (!household.city || household.city === "Other") {
      $set.city = "Karachi";
      applied.city = $set.city;
    }
    const survival = household.survival || {};
    if (!survival.housingMinor && !survival.foodMinor) {
      $set.survival = {
        housingMinor: 30000 * 100,
        foodMinor: 35000 * 100,
        utilitiesMinor: 12000 * 100,
        transportMinor: 8000 * 100,
        medicalMinor: 5000 * 100,
        educationMinor: 10000 * 100,
        otherEssentialMinor: 3000 * 100,
        useLocationEstimates: false,
      };
      applied.survival = $set.survival;
    }
    $set.demoSeed = applied;
    await Household.updateOne({ _id: hid }, { $set });
    await audit(membership, session.user.id, "seed", "demo", "example-data");
    return json({
      ok: true,
      counts: { incomes: incomes.length, expenses: expenses.length },
      seededAt: $set.demoSeededAt,
    });
  } catch (err) {
    return handle(err);
  }
}

export async function DELETE() {
  try {
    const session = await requireSession();
    const membership = await requireMembership(session.user.id);
    assertWrite(membership);
    const hid = membership.householdId;
    const household = await Household.findById(hid).lean();
    const [incomes, expenses, goals, events] = await Promise.all([
      Income.deleteMany({ householdId: hid, isDemo: true }),
      Expense.deleteMany({ householdId: hid, isDemo: true }),
      Goal.deleteMany({ householdId: hid, isDemo: true }),
      SpecialEvent.deleteMany({ householdId: hid, isDemo: true }),
    ]);
    // Restore only the household fields that seeding filled in and the user has not
    // changed since. Anything the user edited after loading examples is left alone.
    const applied = household?.demoSeed || {};
    const $set = { demoSeededAt: null, demoSeed: null };
    if (applied.startingBalanceMinor != null && (household.startingBalanceMinor || 0) === applied.startingBalanceMinor) {
      $set.startingBalanceMinor = 0;
    }
    if (applied.emergencyReserveMinor != null && (household.emergencyReserveMinor || 0) === applied.emergencyReserveMinor) {
      $set.emergencyReserveMinor = 0;
    }
    if (applied.savingsBalanceMinor != null && (household.savingsBalanceMinor || 0) === applied.savingsBalanceMinor) {
      $set.savingsBalanceMinor = 0;
    }
    if (applied.members && JSON.stringify(household.members || []) === JSON.stringify(applied.members)) {
      $set.members = [];
    }
    if (applied.city && household.city === applied.city) {
      $set.city = "Other";
    }
    if (applied.survival && JSON.stringify(household.survival || {}) === JSON.stringify(applied.survival)) {
      $set.survival = {};
    }
    await Household.updateOne({ _id: hid }, { $set });
    await audit(membership, session.user.id, "clear", "demo", "example-data");
    return json({
      ok: true,
      removed: {
        incomes: incomes.deletedCount,
        expenses: expenses.deletedCount,
        goals: goals.deletedCount,
        events: events.deletedCount,
      },
      restored: Object.keys($set).filter((key) => !["demoSeededAt", "demoSeed"].includes(key)),
    });
  } catch (err) {
    return handle(err);
  }
}

export const dynamic = "force-dynamic";
