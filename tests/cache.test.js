const test = require("node:test");
const assert = require("node:assert/strict");

async function cacheModule() {
  return import("../lib/cache.js");
}

test("cache reads and writes are isolated clones", async () => {
  const { cacheClear, cacheGet, cacheSet } = await cacheModule();
  cacheClear();
  const original = { expenses: [{ amountMinor: 1234 }], nested: { ok: true } };
  cacheSet("h1:plan", original, 5_000);
  original.expenses[0].amountMinor = 9999;

  const first = cacheGet("h1:plan");
  assert.deepEqual(first, { expenses: [{ amountMinor: 1234 }], nested: { ok: true } });
  first.expenses[0].amountMinor = 7777;
  first.nested.ok = false;

  const second = cacheGet("h1:plan");
  assert.equal(second.expenses[0].amountMinor, 1234);
  assert.equal(second.nested.ok, true);
  cacheClear();
});

test("cache expiry and household invalidation remove only the intended keys", async () => {
  const { cacheClear, cacheGet, cacheInvalidateHousehold, cacheSet, cacheSize } = await cacheModule();
  cacheClear();
  cacheSet("h1:stale", { value: 1 }, -1);
  assert.equal(cacheGet("h1:stale"), null);

  cacheSet("h1:a", { value: "a" }, 5_000);
  cacheSet("h1:b", { value: "b" }, 5_000);
  cacheSet("h2:a", { value: "other" }, 5_000);
  assert.equal(cacheSize(), 3);

  cacheInvalidateHousehold("h1");
  assert.equal(cacheGet("h1:a"), null);
  assert.equal(cacheGet("h1:b"), null);
  assert.deepEqual(cacheGet("h2:a"), { value: "other" });
  cacheClear();
  assert.equal(cacheSize(), 0);
});

test("cache stays bounded when many household plans are generated", async () => {
  const { cacheClear, cacheGet, cacheSet, cacheSize } = await cacheModule();
  cacheClear();
  for (let index = 0; index < 501; index += 1) {
    cacheSet(`h1:plan:${index}`, { index }, 30_000);
  }
  // The sweep runs on the next access and drops the oldest entries.
  cacheGet("h1:plan:501");
  assert.ok(cacheSize() <= 500, `expected at most 500 entries, got ${cacheSize()}`);
  assert.notEqual(cacheGet("h1:plan:499"), null);
  cacheClear();
});
