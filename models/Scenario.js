import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    householdId: { type: mongoose.Schema.Types.ObjectId, ref: "Household", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
    appliedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

schema.index({ householdId: 1, createdAt: -1 });

export default mongoose.models.Scenario || mongoose.model("Scenario", schema);
