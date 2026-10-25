import mongoose from "mongoose";

const schema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    passwordHash: { type: String, required: true },
    emailVerifiedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

schema.index({ email: 1 }, { unique: true });

export default mongoose.models.User || mongoose.model("User", schema);
