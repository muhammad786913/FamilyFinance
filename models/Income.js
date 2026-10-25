import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    householdId: { type: mongoose.Schema.Types.ObjectId, ref: "Household", required: true, index: true },
    scheduleId: { type: String, default: null },
    occurrenceKey: { type: String, default: null },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    category: {
      type: String,
      enum: ["salary", "weekly_wage", "daily_wage", "freelance", "business", "irregular", "household_contribution", "other"],
      default: "other",
    },
    amountMinor: { type: Number, required: true, min: 0 },
    receivedMinor: { type: Number, default: 0, min: 0 },
    expectedDate: { type: String, required: true },
    receivedDate: { type: String, default: null },
    frequency: { type: String, enum: ["once", "daily", "weekly", "monthly", "yearly"], default: "once" },
    status: { type: String, enum: ["expected", "partial", "received", "delayed", "cancelled"], default: "expected" },
    estimated: { type: Boolean, default: true },
    notes: { type: String, default: "", maxlength: 500 },
    payments: { type: [{ amountMinor: Number, date: String, note: String }], default: [] },
  },
  { timestamps: true }
);

schema.index({ householdId: 1, expectedDate: 1, status: 1 });
schema.index({ householdId: 1, occurrenceKey: 1 }, { unique: true, sparse: true });
schema.index({ householdId: 1, category: 1 });

export default mongoose.models.Income || mongoose.model("Income", schema);
