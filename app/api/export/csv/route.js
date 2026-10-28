import Income from "@/models/Income";
import Expense from "@/models/Expense";
import { incomeCsv, expenseCsv } from "@/lib/csv";
import { transactionFilter } from "@/lib/planContext";
import { requireSession, requireMembership, handle } from "@/lib/api";

export async function GET(req) {
  try {
    const session = await requireSession();
    const membership = await requireMembership(session.user.id);
    const url = new URL(req.url);
    const type = url.searchParams.get("type") === "expenses" ? "expenses" : "income";
    const hid = membership.householdId;
    let csv;
    if (type === "expenses") {
      const items = await Expense.find({ householdId: hid, ...transactionFilter() }).sort({ dueDate: 1 }).lean();
      csv = expenseCsv(items);
    } else {
      const items = await Income.find({ householdId: hid, ...transactionFilter() }).sort({ expectedDate: 1 }).lean();
      csv = incomeCsv(items);
    }
    const stamp = new Date().toISOString().slice(0, 10);
    return new Response(`\uFEFF${csv}`, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="familyfinance-${type}-${stamp}.csv"`,
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    return handle(err);
  }
}

export const dynamic = "force-dynamic";
