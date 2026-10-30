/**
 * Per-process sliding-window limiter with escalating penalties.
 * For multi-instance production, back this with Redis (same interface).
 *
 * A single IP that keeps hammering a limit is not just rejected for the rest of
 * the window: it earns strikes, and each strike multiplies the ban up to 6h.
 */

const buckets = new Map();
const MAX_BUCKETS = 20_000;
// A shared office/NAT address must not be locked out for a whole day because one
// device misbehaved. Beyond this, bad traffic is still rejected per request.
const MAX_BAN_MS = 15 * 60 * 1000;

function sweep(now) {
  if (buckets.size <= MAX_BUCKETS) return;
  const horizon = now - 60 * 60 * 1000;
  for (const [key, b] of buckets) {
    if (b.blockedUntil <= now && (!b.times.length || b.times[b.times.length - 1] < horizon)) {
      buckets.delete(key);
    }
  }
}

function rateLimit(key, { limit = 30, windowMs = 60_000, banMs = 0 } = {}) {
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { times: [], strikes: 0, blockedUntil: 0, lastSeen: now };
    buckets.set(key, bucket);
  } else {
    bucket.lastSeen = now;
  }

  if (bucket.blockedUntil > now) {
    return { ok: false, retryAfterMs: bucket.blockedUntil - now, banned: true, strikes: bucket.strikes };
  }
  if (bucket.blockedUntil && bucket.blockedUntil <= now) bucket.blockedUntil = 0;

  bucket.times = bucket.times.filter((t) => now - t < windowMs);

  if (bucket.times.length >= limit) {
    bucket.strikes = Math.min(bucket.strikes + 1, 10);
    let retryAfterMs = windowMs - (now - bucket.times[0]);
    if (banMs > 0) {
      const penalty = Math.min(banMs * 2 ** (bucket.strikes - 1), MAX_BAN_MS);
      bucket.blockedUntil = now + penalty;
      retryAfterMs = penalty;
    }
    sweep(now);
    return { ok: false, retryAfterMs, banned: banMs > 0, strikes: bucket.strikes };
  }

  bucket.times.push(now);
  sweep(now);
  return { ok: true, remaining: limit - bucket.times.length, strikes: bucket.strikes };
}

/** Forget one key (used by tests and by successful logins). */
function resetLimit(key) {
  buckets.delete(key);
}

function retryAfterSeconds(rl) {
  return Math.max(1, Math.ceil((rl.retryAfterMs || 1000) / 1000));
}

/** Best-effort client IP. Take the LAST proxy hop: standard proxies append the
 *  peer they saw, so a client-supplied leading value cannot spoof the bucket. */
function clientIp(req) {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const hops = forwarded.split(",").map((s) => s.trim()).filter(Boolean);
    if (hops.length) return hops[hops.length - 1];
  }
  return req.headers.get("x-real-ip") || "direct";
}


module.exports = { rateLimit, resetLimit, retryAfterSeconds, clientIp };

