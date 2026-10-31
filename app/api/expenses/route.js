import Expense from "@/models/Expense";
import {
  json,
  requireSession,
  requireMembership,
  parseJson,
  assertWrite,
  handle,
  moneyField,
  ymd,
  paginate,
  audit,
} from "@/lib/api";
import { EXPENSE_CATEGORIES, FREQUENCIES } from "@/lib/constants";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { occurrenceKey } from "@/lib/engine/recurring";
import { ensureOccurrences, defaultPeriod, firstOccurrence, transactionFilter } from "@/lib/planContext";
import Household from "@/models/Household";

export async function GET(req) {
  try {
    const session = await requireSession();
    const membership = await requireMembership(session.user.id);
    const url = new URL(req.url);
    const { skip, limit, page } = paginate(url.searchParams);
    const household = await Household.findById(membership.householdId).lean();
    const period = defaultPeriod(household);
    await ensureOccurrences(membership.householdId, period.start, period.end);
    const filter = { householdId: membership.householdId, ...transactionFilter() };
    const status = url.searchParams.get("status");
    const category = url.searchParams.get("category");
    if (status) filter.status = status;
    if (category) filter.category = category;
    const [items, total] = await Promise.all([
      Expense.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
      Expense.countDocuments(filter),
    ]);
    return json({ items, total, page, limit });
  } catch (err) {
    return handle(err);
  }
}

export async function POST(req) {
  try {
    const session = await requireSession();
    const membership = await requireMembership(session.user.id);
    assertWrite(membership);
    const rl = rateLimit(`exp:${membership.householdId}:${clientIp(req)}`, { limit: 60, windowMs: 60_000 });
    if (!rl.ok) return json({ error: "Too many requests." }, 429);
    const body = await parseJson(req);
    const dueDate = ymd(body.dueDate, "due date");
    const frequency = FREQUENCIES.includes(body.frequency) ? body.frequency : "once";
    const doc = {
      householdId: membership.householdId,
      name: String(body.name || "").trim().slice(0, 120),
      category: EXPENSE_CATEGORIES.includes(body.category) ? body.category : "other",
      amountMinor: moneyField(body.amount, "amount", { positive: true }),
      dueDate,
      originalDueDate: dueDate,
      frequency,
      essential: body.essential !== false,
      priority: Math.min(9, Math.max(1, Number(body.priority) || 5)),
      notes: String(body.notes || "").slice(0, 500),
    };
    if (!doc.name) return json({ error: "Name is required." }, 400);
    if (frequency === "once") {
      doc.occurrenceKey = occurrenceKey(`once-e-${membership.householdId}-${doc.name}-${dueDate}-${doc.amountMinor}`, dueDate);
      const duplicate = await Expense.exists({ householdId: membership.householdId, occurrenceKey: doc.occurrenceKey });
      if (duplicate) return json({ error: "This bill already exists for that date." }, 409);
    }
    const item = await Expense.create(doc);
    if (frequency !== "once") {
      await Expense.create(firstOccurrence("expense", item)).catch((err) => {
        if (err.code !== 11000) throw err;
      });
    }
    await audit(membership, session.user.id, "create", "expense", item._id);
    return json({ item }, 201);
  } catch (err) {
    if (err.code === 11000) return json({ error: "This bill already exists for that date." }, 409);
    return handle(err);
  }
}
export const dynamic = "force-dynamic";
