import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    householdId: { type: mongoose.Schema.Types.ObjectId, ref: "Household", required: true, index: true },
    date: { type: String, required: true },
    // Snapshot of the safe-to-spend amount the person saw when they checked in.
    // Kept so history stays honest even if bills or income change later.
    budgetMinor: { type: Number, required: true, min: 0, default: 0 },
    spentMinor: { type: Number, required: true, min: 0 },
    note: { type: String, default: "", maxlength: 200 },
  },
  { timestamps: true }
);

schema.index({ householdId: 1, date: 1 }, { unique: true });

export default mongoose.models.DailyCheckin || mongoose.model("DailyCheckin", schema);
