import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    householdId: { type: mongoose.Schema.Types.ObjectId, ref: "Household", required: true, index: true },
    scheduleId: { type: String, default: null },
    occurrenceKey: { type: String, default: null },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    category: {
      type: String,
      enum: [
        "rent_housing",
        "groceries",
        "electricity_gas_water",
        "internet_phone",
        "education",
        "transport",
        "medical",
        "debt",
        "family_support",
        "clothing",
        "entertainment",
        "other",
      ],
      default: "other",
    },
    amountMinor: { type: Number, required: true, min: 0 },
    paidMinor: { type: Number, default: 0, min: 0 },
    dueDate: { type: String, required: true },
    paidDate: { type: String, default: null },
    originalDueDate: { type: String, required: true },
    frequency: { type: String, enum: ["once", "daily", "weekly", "monthly", "yearly"], default: "once" },
    status: { type: String, enum: ["unpaid", "partial", "paid", "overdue", "cancelled"], default: "unpaid" },
    essential: { type: Boolean, default: true },
    priority: { type: Number, default: 5, min: 1, max: 9 },
    notes: { type: String, default: "", maxlength: 500 },
    payments: { type: [{ amountMinor: Number, date: String, note: String }], default: [] },
  },
  { timestamps: true }
);

schema.index({ householdId: 1, dueDate: 1, status: 1 });
schema.index({ householdId: 1, occurrenceKey: 1 }, { unique: true, sparse: true });
schema.index({ householdId: 1, category: 1, essential: 1 });

export default mongoose.models.Expense || mongoose.model("Expense", schema);
