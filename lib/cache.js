const store = new Map();
const MAX_ENTRIES = 500;
let lastSweep = 0;
const SWEEP_INTERVAL_MS = 1_000;

function clone(value) {
  if (value == null || typeof value !== "object") return value;
  try {
    return structuredClone(value);
  } catch {
    // Plan inputs are JSON-compatible; this covers exotic Mongoose scalar types.
    return JSON.parse(JSON.stringify(value));
  }
}

function sweep(now) {
  if (now - lastSweep < SWEEP_INTERVAL_MS && store.size <= MAX_ENTRIES) return;
  lastSweep = now;
  for (const [key, row] of store) {
    if (now > row.exp) store.delete(key);
  }
  while (store.size > MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest === undefined) break;
    store.delete(oldest);
  }
}

export function cacheGet(key) {
  const now = Date.now();
  sweep(now);
  const row = store.get(key);
  if (!row) return null;
  if (now > row.exp) {
    store.delete(key);
    return null;
  }
  return clone(row.value);
}

export function cacheSet(key, value, ttlMs = 15_000) {
  const now = Date.now();
  sweep(now);
  store.set(key, { value: clone(value), exp: now + ttlMs });
}

export function cacheInvalidateHousehold(householdId) {
  const prefix = `${householdId}:`;
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

export function cacheSize() {
  return store.size;
}

export function cacheClear() {
  store.clear();
  lastSweep = 0;
}
