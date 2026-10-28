/**
 * One-off repair for databases created before recurring templates stopped storing
 * `occurrenceKey`. Two problems are fixed per collection:
 *
 * 1. Templates stored `occurrenceKey: null`. A *sparse compound* index still indexes
 *    rows that have `householdId` (always present), so only one template per
 *    household could exist. The index is now a *partial* unique index that only
 *    covers string occurrence keys.
 * 2. Duplicate occurrence keys are de-duplicated before the unique index is built.
 *    The row with recorded payments is kept.
 *
 * Run once: npm run repair
 */
const mongoose = require("mongoose");

const COLLECTIONS = {
  incomes: { progress: "receivedMinor", payments: "payments" },
  expenses: { progress: "paidMinor", payments: "payments" },
};

async function repairCollection(db, name, fields) {
  const collection = db.collection(name);

  const cleared = await collection.updateMany({ occurrenceKey: null }, { $unset: { occurrenceKey: "" } });
  console.log(`${name}: cleared ${cleared.modifiedCount} null occurrenceKey value(s)`);

  const groups = await collection
    .aggregate([
      { $match: { occurrenceKey: { $type: "string" } } },
      {
        $group: {
          _id: { householdId: "$householdId", occurrenceKey: "$occurrenceKey" },
          ids: { $push: "$_id" },
          count: { $sum: 1 },
        },
      },
      { $match: { count: { $gt: 1 } } },
    ])
    .toArray();

  let removed = 0;
  for (const group of groups) {
    const rows = await collection
      .find({ _id: { $in: group.ids } })
      .project({ _id: 1, [fields.progress]: 1, [fields.payments]: 1, createdAt: 1 })
      .toArray();
    rows.sort((a, b) => {
      const byProgress = (b[fields.progress] || 0) - (a[fields.progress] || 0);
      if (byProgress) return byProgress;
      const byPayments = (b[fields.payments] || []).length - (a[fields.payments] || []).length;
      if (byPayments) return byPayments;
      return String(a.createdAt || "").localeCompare(String(b.createdAt || ""));
    });
    const keep = rows[0];
    const drop = group.ids.filter((id) => String(id) !== String(keep._id));
    if (drop.length) {
      const result = await collection.deleteMany({ _id: { $in: drop } });
      removed += result.deletedCount;
    }
  }
  console.log(`${name}: removed ${removed} duplicate occurrence row(s)`);

  const indexes = await collection.indexes();
  const old = indexes.find((idx) => idx.name === "householdId_1_occurrenceKey_1");
  if (old) {
    await collection.dropIndex(old.name);
    console.log(`${name}: dropped old index ${old.name}`);
  }
  await collection.createIndex(
    { householdId: 1, occurrenceKey: 1 },
    { unique: true, partialFilterExpression: { occurrenceKey: { $type: "string" } } }
  );
  console.log(`${name}: partial unique occurrence index ready`);
}

async function main() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI missing");
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  for (const [name, fields] of Object.entries(COLLECTIONS)) {
    await repairCollection(db, name, fields);
  }
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
