import Household from "@/models/Household";
import Membership from "@/models/Membership";
import {
  json,
  requireSession,
  requireMembership,
  parseJson,
  assertWrite,
  handle,
  moneyField,
  optionalMoneyField,
  audit,
} from "@/lib/api";
import { connectDb } from "@/lib/db";
import { retryOnDuplicate } from "@/lib/retry";

export async function GET() {
  try {
    const session = await requireSession();
    const membership = await requireMembership(session.user.id);
    const household = await Household.findById(membership.householdId).lean();
    return json({ household, role: membership.role });
  } catch (err) {
    return handle(err);
  }
}

export async function POST() {
  try {
    const session = await requireSession();
    await connectDb();
    const existing = await Membership.findOne({ userId: session.user.id }).lean();
    if (existing) return json({ error: "Household already exists." }, 409);
    const household = await Household.create({ name: "My household" });
    await retryOnDuplicate(() =>
      Membership.create({ userId: session.user.id, householdId: household._id, role: "owner" })
    );
    return json({ household, role: "owner" }, 201);
  } catch (err) {
    if (err.code === 11000) return json({ error: "Household already exists." }, 409);
    return handle(err);
  }
}

export async function PATCH(req) {
  try {
    const session = await requireSession();
    const membership = await requireMembership(session.user.id);
    assertWrite(membership);
    const body = await parseJson(req);
    const $set = {};
    const str = ["name", "country", "currency", "locale", "timezone", "city"];
    for (const k of str) if (body[k] != null) $set[k] = String(body[k]).slice(0, 80);
    if (body.planningStartDay != null) $set.planningStartDay = Math.min(28, Math.max(1, Number(body.planningStartDay)));
    if (body.weekStartsOn != null) $set.weekStartsOn = Math.min(6, Math.max(0, Number(body.weekStartsOn)));
    if (body.startingBalance != null) $set.startingBalanceMinor = moneyField(body.startingBalance, "starting balance");
    if (body.savingsBalance != null) $set.savingsBalanceMinor = moneyField(body.savingsBalance, "savings");
    if (body.emergencyReserve != null) $set.emergencyReserveMinor = moneyField(body.emergencyReserve, "reserve");
    if (body.setupComplete != null) $set.setupComplete = !!body.setupComplete;
    if (Array.isArray(body.members)) {
      $set.members = body.members.slice(0, 20).map((m) => ({
        label: String(m.label || "Member").slice(0, 40),
        ageGroup: ["child", "teen", "adult", "senior", "unspecified"].includes(m.ageGroup) ? m.ageGroup : "unspecified",
      }));
    }
    if (body.survival && typeof body.survival === "object") {
      const s = body.survival;
      $set.survival = {
        housingMinor: optionalMoneyField(s.housing, "housing"),
        foodMinor: optionalMoneyField(s.food, "food"),
        utilitiesMinor: optionalMoneyField(s.utilities, "utilities"),
        transportMinor: optionalMoneyField(s.transport, "transport"),
        medicalMinor: optionalMoneyField(s.medical, "medical"),
        educationMinor: optionalMoneyField(s.education, "education"),
        otherEssentialMinor: optionalMoneyField(s.other, "other"),
        useLocationEstimates: !!s.useLocationEstimates,
      };
    }
    const household = await Household.findByIdAndUpdate(membership.householdId, { $set }, { new: true }).lean();
    await audit(membership, session.user.id, "update", "household", membership.householdId);
    return json({ household, role: membership.role });
  } catch (err) {
    return handle(err);
  }
}

export async function DELETE() {
  try {
    const session = await requireSession();
    const membership = await requireMembership(session.user.id);
    if (membership.role !== "owner") return json({ error: "Only the owner can delete this household." }, 403);
    const Income = (await import("@/models/Income")).default;
    const Expense = (await import("@/models/Expense")).default;
    const Goal = (await import("@/models/Goal")).default;
    const SpecialEvent = (await import("@/models/SpecialEvent")).default;
    const Scenario = (await import("@/models/Scenario")).default;
    const DailyCheckin = (await import("@/models/DailyCheckin")).default;
    const AuditLog = (await import("@/models/AuditLog")).default;
    const hid = membership.householdId;
    await Promise.all([
      Income.deleteMany({ householdId: hid }),
      Expense.deleteMany({ householdId: hid }),
      Goal.deleteMany({ householdId: hid }),
      SpecialEvent.deleteMany({ householdId: hid }),
      Scenario.deleteMany({ householdId: hid }),
      DailyCheckin.deleteMany({ householdId: hid }),
      AuditLog.deleteMany({ householdId: hid }),
      Membership.deleteMany({ householdId: hid }),
      Household.deleteOne({ _id: hid }),
    ]);
    // The delete itself is written after the cleanup so it is not wiped with
    // the household's earlier audit trail.
    await audit(membership, session.user.id, "delete", "household", hid);
    return json({ ok: true });
  } catch (err) {
    return handle(err);
  }
}
export const dynamic = "force-dynamic";
