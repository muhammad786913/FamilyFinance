import mongoose from "mongoose";

const memberSnap = new mongoose.Schema(
  {
    label: String,
    ageGroup: { type: String, enum: ["child", "teen", "adult", "senior", "unspecified"], default: "unspecified" },
  },
  { _id: false }
);

const schema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    country: { type: String, default: "PK" },
    currency: { type: String, default: "PKR" },
    locale: { type: String, default: "en-PK" },
    timezone: { type: String, default: "Asia/Karachi" },
    city: { type: String, default: "Other" },
    planningStartDay: { type: Number, default: 1, min: 1, max: 28 },
    weekStartsOn: { type: Number, default: 1, min: 0, max: 6 },
    startingBalanceMinor: { type: Number, default: 0 },
    savingsBalanceMinor: { type: Number, default: 0 },
    emergencyReserveMinor: { type: Number, default: 0 },
    setupComplete: { type: Boolean, default: false },
    demoSeededAt: { type: Date, default: null },
    demoSeed: { type: mongoose.Schema.Types.Mixed, default: null },
    members: { type: [memberSnap], default: [] },
    survival: {
      housingMinor: { type: Number, default: 0 },
      foodMinor: { type: Number, default: 0 },
      utilitiesMinor: { type: Number, default: 0 },
      transportMinor: { type: Number, default: 0 },
      medicalMinor: { type: Number, default: 0 },
      educationMinor: { type: Number, default: 0 },
      otherEssentialMinor: { type: Number, default: 0 },
      useLocationEstimates: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

export default mongoose.models.Household || mongoose.model("Household", schema);
