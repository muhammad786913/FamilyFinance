const mongoose = require("mongoose");

async function occurrenceIndex(db, collection) {
  const indexes = await db.collection(collection).indexes().catch(() => []);
  const existing = indexes.find((idx) => idx.name === "householdId_1_occurrenceKey_1");
  if (existing && !existing.partialFilterExpression) {
    await db.collection(collection).dropIndex(existing.name);
    console.log(`${collection}: dropped legacy sparse occurrence index`);
  }
  await db.collection(collection).createIndex(
    { householdId: 1, occurrenceKey: 1 },
    { unique: true, partialFilterExpression: { occurrenceKey: { $type: "string" } } }
  );
}

async function main() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI missing");
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  await db.collection("users").createIndex({ email: 1 }, { unique: true });
  await db.collection("memberships").createIndex({ userId: 1, householdId: 1 }, { unique: true });
  await db.collection("incomes").createIndex({ householdId: 1, expectedDate: 1, status: 1 });
  await occurrenceIndex(db, "incomes");
  await db.collection("expenses").createIndex({ householdId: 1, dueDate: 1, status: 1 });
  await occurrenceIndex(db, "expenses");
  await db.collection("goals").createIndex({ householdId: 1, targetDate: 1 });
  await db.collection("specialevents").createIndex({ householdId: 1, targetDate: 1 });
  console.log("Indexes ensured");
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
