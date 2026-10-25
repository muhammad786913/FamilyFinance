import Income from "@/models/Income";
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
import { INCOME_CATEGORIES, FREQUENCIES } from "@/lib/constants";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { occurrenceKey } from "@/lib/engine/recurring";

export async function GET(req) {
  try {
    const session = await requireSession();
    const membership = await requireMembership(session.user.id);
    const url = new URL(req.url);
    const { skip, limit, page } = paginate(url.searchParams);
    const status = url.searchParams.get("status");
    const filter = { householdId: membership.householdId };
    if (status) filter.status = status;
    const [items, total] = await Promise.all([
      Income.find(filter).sort({ expectedDate: 1 }).skip(skip).limit(limit).lean(),
      Income.countDocuments(filter),
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
    const rl = rateLimit(`income:${membership.householdId}`, { limit: 60, windowMs: 60_000 });
    if (!rl.ok) return json({ error: "Too many requests." }, 429);
    const body = await parseJson(req);
    const expectedDate = ymd(body.expectedDate, "expected date");
    const frequency = FREQUENCIES.includes(body.frequency) ? body.frequency : "once";
    const doc = {
      householdId: membership.householdId,
      name: String(body.name || "").trim().slice(0, 120),
      category: INCOME_CATEGORIES.includes(body.category) ? body.category : "other",
      amountMinor: moneyField(body.amount, "amount"),
      expectedDate,
      frequency,
      estimated: body.estimated !== false,
      notes: String(body.notes || "").slice(0, 500),
    };
    if (!doc.name) return json({ error: "Name is required." }, 400);
    if (frequency === "once") {
      doc.occurrenceKey = occurrenceKey(`once-${membership.householdId}-${doc.name}-${expectedDate}-${doc.amountMinor}`, expectedDate);
    }
    const item = await Income.create(doc);
    await audit(membership, session.user.id, "create", "income", item._id);
    return json({ item }, 201);
  } catch (err) {
    if (err.code === 11000) return json({ error: "This income entry already exists for that date." }, 409);
    return handle(err);
  }
}
