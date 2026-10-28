import Household from "@/models/Household";
import Membership from "@/models/Membership";
import { json, requireSession, requireMembership, parseJson, assertWrite, handle, moneyField } from "@/lib/api";
import { connectDb } from "@/lib/db";

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
    await Membership.create({ userId: session.user.id, householdId: household._id, role: "owner" });
    return json({ household, role: "owner" }, 201);
  } catch (err) {
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
        housingMinor: s.housing != null ? moneyField(s.housing, "housing") : 0,
        foodMinor: s.food != null ? moneyField(s.food, "food") : 0,
        utilitiesMinor: s.utilities != null ? moneyField(s.utilities, "utilities") : 0,
        transportMinor: s.transport != null ? moneyField(s.transport, "transport") : 0,
        medicalMinor: s.medical != null ? moneyField(s.medical, "medical") : 0,
        educationMinor: s.education != null ? moneyField(s.education, "education") : 0,
        otherEssentialMinor: s.other != null ? moneyField(s.other, "other") : 0,
        useLocationEstimates: !!s.useLocationEstimates,
      };
    }
    const household = await Household.findByIdAndUpdate(membership.householdId, { $set }, { new: true }).lean();
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
    const AuditLog = (await import("@/models/AuditLog")).default;
    const hid = membership.householdId;
    await Promise.all([
      Income.deleteMany({ householdId: hid }),
      Expense.deleteMany({ householdId: hid }),
      Goal.deleteMany({ householdId: hid }),
      SpecialEvent.deleteMany({ householdId: hid }),
      Scenario.deleteMany({ householdId: hid }),
      AuditLog.deleteMany({ householdId: hid }),
      Membership.deleteMany({ householdId: hid }),
      Household.deleteOne({ _id: hid }),
    ]);
    return json({ ok: true });
  } catch (err) {
    return handle(err);
  }
}
export const dynamic = "force-dynamic";
