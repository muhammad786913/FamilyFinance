import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    householdId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, required: true },
    action: { type: String, required: true },
    entity: { type: String, required: true },
    entityId: { type: String, default: "" },
  },
  { timestamps: true }
);

schema.index({ householdId: 1, createdAt: -1 });

export default mongoose.models.AuditLog || mongoose.model("AuditLog", schema);
