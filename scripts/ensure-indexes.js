const mongoose = require("mongoose");

async function main() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI missing");
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  await db.collection("users").createIndex({ email: 1 }, { unique: true });
  await db.collection("memberships").createIndex({ userId: 1, householdId: 1 }, { unique: true });
  await db.collection("incomes").createIndex({ householdId: 1, expectedDate: 1, status: 1 });
  await db.collection("incomes").createIndex({ householdId: 1, occurrenceKey: 1 }, { unique: true, sparse: true });
  await db.collection("expenses").createIndex({ householdId: 1, dueDate: 1, status: 1 });
  await db.collection("expenses").createIndex({ householdId: 1, occurrenceKey: 1 }, { unique: true, sparse: true });
  await db.collection("goals").createIndex({ householdId: 1, targetDate: 1 });
  await db.collection("specialevents").createIndex({ householdId: 1, targetDate: 1 });
  console.log("Indexes ensured");
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
