const test = require("node:test");
const assert = require("node:assert/strict");
const { retryOnDuplicate, isDuplicateKeyError } = require("../lib/retry");

function duplicate() {
  const error = new Error("E11000 duplicate key");
  error.code = 11000;
  return error;
}

test("duplicate-key races are retried once and can succeed", async () => {
  let attempts = 0;
  const result = await retryOnDuplicate(() => {
    attempts += 1;
    if (attempts === 1) throw duplicate();
    return "inserted";
  });
  assert.equal(result, "inserted");
  assert.equal(attempts, 2);
});

test("duplicate-key failures still surface after the retry budget", async () => {
  let attempts = 0;
  await assert.rejects(
    retryOnDuplicate(() => {
      attempts += 1;
      throw duplicate();
    }),
    /E11000/
  );
  assert.equal(attempts, 2);
});

test("non-duplicate errors are never retried", async () => {
  let attempts = 0;
  const failure = new Error("validation failed");
  await assert.rejects(
    retryOnDuplicate(() => {
      attempts += 1;
      throw failure;
    }),
    /validation failed/
  );
  assert.equal(attempts, 1);
  assert.equal(isDuplicateKeyError(failure), false);
  assert.equal(isDuplicateKeyError({ code: 11001 }), true);
  assert.equal(isDuplicateKeyError(null), false);
});

test("attempt counts below one still run the operation once", async () => {
  let attempts = 0;
  assert.equal(await retryOnDuplicate(() => ++attempts, 0), 1);
  assert.equal(attempts, 1);
});
