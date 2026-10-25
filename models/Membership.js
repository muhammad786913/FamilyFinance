import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    householdId: { type: mongoose.Schema.Types.ObjectId, ref: "Household", required: true, index: true },
    role: { type: String, enum: ["owner", "admin", "member", "readonly"], default: "owner" },
  },
  { timestamps: true }
);

schema.index({ userId: 1, householdId: 1 }, { unique: true });
schema.index({ householdId: 1, role: 1 });

export default mongoose.models.Membership || mongoose.model("Membership", schema);
