const store = new Map();

export function cacheGet(key) {
  const row = store.get(key);
  if (!row) return null;
  if (Date.now() > row.exp) {
    store.delete(key);
    return null;
  }
  return row.value;
}

export function cacheSet(key, value, ttlMs = 15_000) {
  store.set(key, { value, exp: Date.now() + ttlMs });
}

export function cacheInvalidateHousehold(householdId) {
  const prefix = `${householdId}:`;
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}
