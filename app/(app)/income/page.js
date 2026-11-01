"use client";

import { Records } from "@/components/Records";
import { formatMoney } from "@/lib/format";

const CATEGORIES = [
  ["salary", "Monthly salary"],
  ["weekly_wage", "Weekly income"],
  ["daily_wage", "Daily wages"],
  ["freelance", "Freelance"],
  ["business", "Business"],
  ["irregular", "Irregular"],
  ["household_contribution", "Household contribution"],
  ["other", "Other"],
];

const STATUSES = [
  ["", "All statuses"],
  ["expected", "Expected"],
  ["partial", "Partially received"],
  ["received", "Received"],
  ["delayed", "Delayed"],
  ["cancelled", "Cancelled"],
];

export default function IncomePage() {
  return (
    <Records
      title="Income"
      endpoint="/api/income"
      kind="income"
      submitLabel="Add income"
      payField="receive"
      filters={[
        { name: "status", label: "Status", options: STATUSES },
        { name: "category", label: "Category", options: [["", "All categories"], ...CATEGORIES] },
      ]}
      editValues={(item) => ({
        name: item.name,
        amount: item.amountMinor / 100,
        expectedDate: item.expectedDate,
        category: item.category,
        frequency: item.frequency,
        notes: item.notes,
        estimated: item.estimated,
      })}
      renderMeta={(item) =>
        `${formatMoney(item.amountMinor)} expected ${item.expectedDate} · received ${formatMoney(item.receivedMinor)}`
      }
      fields={[
        { name: "name", label: "Source", required: true },
        { name: "amount", label: "Amount (PKR)", type: "number", step: "0.01", required: true },
        { name: "expectedDate", label: "Expected date", type: "date", required: true },
        { name: "category", label: "Category", type: "select", options: CATEGORIES },
        {
          name: "frequency",
          label: "Frequency",
          type: "select",
          options: [
            ["once", "One-time"],
            ["daily", "Daily"],
            ["weekly", "Weekly"],
            ["monthly", "Monthly"],
            ["yearly", "Yearly"],
          ],
        },
        { name: "notes", label: "Notes" },
        { name: "estimated", label: "This amount is estimated", type: "checkbox", defaultChecked: true },
      ]}
    />
  );
}
