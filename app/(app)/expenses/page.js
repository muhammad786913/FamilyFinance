"use client";

import { Records } from "@/components/Records";
import { formatMoney } from "@/lib/format";

export default function ExpensesPage() {
  return (
    <Records
      title="Expenses"
      endpoint="/api/expenses"
      submitLabel="Add bill"
      payField="pay"
      renderMeta={(item) =>
        `${formatMoney(item.amountMinor)} due ${item.dueDate} · paid ${formatMoney(item.paidMinor)}${item.essential ? " · essential" : " · optional"}`
      }
      fields={[
        { name: "name", label: "Bill name", required: true },
        { name: "amount", label: "Amount (PKR)", type: "number", step: "0.01", required: true },
        { name: "dueDate", label: "Due date", type: "date", required: true },
        {
          name: "category",
          label: "Category",
          type: "select",
          options: [
            ["rent_housing", "Rent and housing"],
            ["groceries", "Groceries"],
            ["electricity_gas_water", "Electricity, gas, water"],
            ["internet_phone", "Internet and phone"],
            ["education", "School and education"],
            ["transport", "Transport"],
            ["medical", "Medical"],
            ["debt", "Debt"],
            ["family_support", "Family support"],
            ["clothing", "Clothing"],
            ["entertainment", "Entertainment"],
            ["other", "Other"],
          ],
        },
        {
          name: "frequency",
          label: "Frequency",
          type: "select",
          options: [
            ["once", "One-time"],
            ["weekly", "Weekly"],
            ["monthly", "Monthly"],
            ["yearly", "Yearly"],
          ],
        },
        { name: "priority", label: "Priority (1 = first)", type: "number", defaultValue: "3" },
        { name: "essential", label: "Essential", type: "checkbox", defaultChecked: true },
        { name: "notes", label: "Notes" },
      ]}
    />
  );
}
