import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    householdId: { type: mongoose.Schema.Types.ObjectId, ref: "Household", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    kind: {
      type: String,
      enum: ["wedding", "dinner", "eid", "guests", "travel", "appliance", "purchase", "other"],
      default: "other",
    },
    amountMinor: { type: Number, required: true, min: 0 },
    targetDate: { type: String, required: true },
    priority: { type: Number, default: 5, min: 1, max: 9 },
    notes: { type: String, default: "", maxlength: 500 },
    includeInPlan: { type: Boolean, default: false },
  },
  { timestamps: true }
);

schema.index({ householdId: 1, targetDate: 1 });

export default mongoose.models.SpecialEvent || mongoose.model("SpecialEvent", schema);
