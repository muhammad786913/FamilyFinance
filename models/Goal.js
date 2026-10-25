import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    householdId: { type: mongoose.Schema.Types.ObjectId, ref: "Household", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    targetMinor: { type: Number, required: true, min: 0 },
    savedMinor: { type: Number, default: 0, min: 0 },
    targetDate: { type: String, required: true },
    priority: { type: Number, default: 5, min: 1, max: 9 },
    contributionMinor: { type: Number, default: 0, min: 0 },
    notes: { type: String, default: "", maxlength: 500 },
  },
  { timestamps: true }
);

schema.index({ householdId: 1, targetDate: 1 });

export default mongoose.models.Goal || mongoose.model("Goal", schema);
