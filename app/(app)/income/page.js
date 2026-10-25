"use client";

import { Records } from "@/components/Records";
import { formatMoney } from "@/lib/format";

export default function IncomePage() {
  return (
    <Records
      title="Income"
      endpoint="/api/income"
      submitLabel="Add income"
      payField="receive"
      renderMeta={(item) =>
        `${formatMoney(item.amountMinor)} expected ${item.expectedDate} · received ${formatMoney(item.receivedMinor)}`
      }
      fields={[
        { name: "name", label: "Source", required: true },
        { name: "amount", label: "Amount (PKR)", type: "number", step: "0.01", required: true },
        { name: "expectedDate", label: "Expected date", type: "date", required: true },
        {
          name: "category",
          label: "Category",
          type: "select",
          options: [
            ["salary", "Monthly salary"],
            ["weekly_wage", "Weekly income"],
            ["daily_wage", "Daily wages"],
            ["freelance", "Freelance"],
            ["business", "Business"],
            ["irregular", "Irregular"],
            ["household_contribution", "Household contribution"],
            ["other", "Other"],
          ],
        },
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
