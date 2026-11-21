const mongoose = require("mongoose");

function indexName(keys) {
  return Object.entries(keys).map(([key, direction]) => `${key}_${direction}`).join("_");
}

function sameJson(left, right) {
  return JSON.stringify(left || {}) === JSON.stringify(right || {});
}

/** Replace a legacy non-unique index before deploying its unique replacement. */
async function ensureUniqueIndex(collection, keys, options = {}) {
  const name = options.name || indexName(keys);
  const indexes = await collection.indexes().catch(() => []);
  const existing = indexes.find((idx) => idx.name === name);
  const matches =
    existing &&
    existing.unique === true &&
    sameJson(existing.key, keys) &&
    sameJson(existing.partialFilterExpression, options.partialFilterExpression);
  if (existing && !matches) await collection.dropIndex(existing.name);
  return collection.createIndex(keys, { ...options, unique: true, name });
}

async function occurrenceIndex(db, collection) {
  await ensureUniqueIndex(db.collection(collection), { householdId: 1, occurrenceKey: 1 }, {
    partialFilterExpression: { occurrenceKey: { $type: "string" } },
  });
}

async function main() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI missing");
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  await ensureUniqueIndex(db.collection("users"), { email: 1 });
  await ensureUniqueIndex(db.collection("memberships"), { userId: 1, householdId: 1 });
  await ensureUniqueIndex(db.collection("memberships"), { userId: 1 });
  await db.collection("incomes").createIndex({ householdId: 1, expectedDate: 1, status: 1 });
  await occurrenceIndex(db, "incomes");
  await db.collection("expenses").createIndex({ householdId: 1, dueDate: 1, status: 1 });
  await occurrenceIndex(db, "expenses");
  await db.collection("goals").createIndex({ householdId: 1, targetDate: 1 });
  await db.collection("specialevents").createIndex({ householdId: 1, targetDate: 1 });
  console.log("Indexes ensured");
  await mongoose.disconnect();
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { ensureUniqueIndex, occurrenceIndex, main };
