const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { ensureUniqueIndex, occurrenceIndex } = require("../scripts/ensure-indexes");

function fakeCollection(existing = []) {
  const calls = [];
  let indexes = existing.map((row) => ({ ...row }));
  return {
    calls,
    async indexes() {
      return indexes.map((row) => ({ ...row }));
    },
    async dropIndex(name) {
      calls.push(["dropIndex", name]);
      indexes = indexes.filter((row) => row.name !== name);
    },
    async createIndex(keys, options) {
      calls.push(["createIndex", keys, options]);
      return options.name;
    },
  };
}

test("a legacy non-unique membership index is replaced by the unique one", async () => {
  const collection = fakeCollection([
    { name: "userId_1", key: { userId: 1 }, background: true },
  ]);
  await ensureUniqueIndex(collection, { userId: 1 });
  assert.deepEqual(collection.calls, [
    ["dropIndex", "userId_1"],
    ["createIndex", { userId: 1 }, { unique: true, name: "userId_1" }],
  ]);
});

test("an already-correct unique index is not dropped", async () => {
  const collection = fakeCollection([
    { name: "userId_1", key: { userId: 1 }, unique: true },
  ]);
  await ensureUniqueIndex(collection, { userId: 1 });
  assert.deepEqual(collection.calls, [
    ["createIndex", { userId: 1 }, { unique: true, name: "userId_1" }],
  ]);
});

test("legacy sparse occurrence indexes are replaced with partial unique ones", async () => {
  const collection = fakeCollection([
    { name: "householdId_1_occurrenceKey_1", key: { householdId: 1, occurrenceKey: 1 }, sparse: true },
  ]);
  const db = { collection: () => collection };
  await occurrenceIndex(db, "incomes");
  assert.deepEqual(collection.calls, [
    ["dropIndex", "householdId_1_occurrenceKey_1"],
    [
      "createIndex",
      { householdId: 1, occurrenceKey: 1 },
      {
        unique: true,
        name: "householdId_1_occurrenceKey_1",
        partialFilterExpression: { occurrenceKey: { $type: "string" } },
      },
    ],
  ]);
});

test("membership schema declares the unique userId index only once", () => {
  const source = fs.readFileSync(path.join(__dirname, "../models/Membership.js"), "utf8");
  assert.match(source, /schema\.index\(\{ userId: 1 \}, \{ unique: true \}\)/);
  assert.doesNotMatch(source, /userId: \{[^}]*index: true/);
});
