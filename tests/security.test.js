const test = require("node:test");
const assert = require("node:assert/strict");
const { rateLimit, resetLimit, retryAfterSeconds } = require("../lib/rateLimit");
const {
  isBlockedPath,
  isStateChanging,
  isAllowedMethod,
  originAllowed,
  contentTypeAllowed,
  budgetFor,
} = require("../lib/botGuard");

test("rate limit allows up to the budget then blocks", () => {
  const key = `test-basic-${Date.now()}`;
  for (let i = 0; i < 3; i++) assert.equal(rateLimit(key, { limit: 3, windowMs: 60_000 }).ok, true);
  const blocked = rateLimit(key, { limit: 3, windowMs: 60_000 });
  assert.equal(blocked.ok, false);
  assert.ok(blocked.retryAfterMs > 0 && blocked.retryAfterMs <= 60_000);
  assert.ok(retryAfterSeconds(blocked) >= 1);
  resetLimit(key);
  assert.equal(rateLimit(key, { limit: 3, windowMs: 60_000 }).ok, true);
});

test("rate limit window expires", async () => {
  const key = `test-window-${Date.now()}`;
  assert.equal(rateLimit(key, { limit: 1, windowMs: 40 }).ok, true);
  assert.equal(rateLimit(key, { limit: 1, windowMs: 40 }).ok, false);
  await new Promise((r) => setTimeout(r, 60));
  assert.equal(rateLimit(key, { limit: 1, windowMs: 40 }).ok, true);
});

test("repeat offenders get an escalating ban", () => {
  const key = `test-ban-${Date.now()}`;
  const opts = { limit: 1, windowMs: 60_000, banMs: 1_000 };
  rateLimit(key, opts);
  const first = rateLimit(key, opts);
  assert.equal(first.banned, true);
  assert.ok(first.retryAfterMs >= 1_000);
  const again = rateLimit(key, opts);
  assert.equal(again.ok, false);
  // The penalty doubles per strike but must never exceed the 15-minute ceiling,
  // otherwise one noisy device locks out everyone behind the same NAT.
  let worst = 0;
  for (let i = 0; i < 12; i += 1) worst = Math.max(worst, rateLimit(key, opts).retryAfterMs || 0);
  assert.ok(worst > 0 && worst <= 15 * 60 * 1000, `cap: ${worst}`);
  assert.ok(again.retryAfterMs > 0);
  resetLimit(key);
});

test("scanner and exploit paths are blocked", () => {
  for (const p of ["/.env", "/.git/config", "/wp-admin/setup.php", "/phpmyadmin/index.php", "/adminer.php", "/backup.sql", "/cgi-bin/x"]) {
    assert.equal(isBlockedPath(p), true, p);
  }
  for (const p of ["/", "/dashboard", "/api/insights", "/login", "/features"]) {
    assert.equal(isBlockedPath(p), false, p);
  }
});

test("only standard methods are accepted", () => {
  for (const m of ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]) assert.equal(isAllowedMethod(m), true, m);
  for (const m of ["TRACE", "TRACK", "CONNECT", "PROPFIND"]) assert.equal(isAllowedMethod(m), false, m);
  assert.equal(isStateChanging("get"), false);
  assert.equal(isStateChanging("post"), true);
});

function reqWith(headers) {
  const map = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return { method: "POST", headers: { get: (k) => map[k.toLowerCase()] ?? null } };
}

test("cross-site writes are rejected, same-origin writes allowed", () => {
  assert.equal(originAllowed(reqWith({ host: "app.test", origin: "http://app.test" })), true);
  assert.equal(originAllowed(reqWith({ host: "app.test", origin: "http://evil.test" })), false);
  assert.equal(originAllowed(reqWith({ host: "app.test", "sec-fetch-site": "cross-site" })), false);
  assert.equal(originAllowed(reqWith({ host: "app.test" })), true);
});

test("our APIs require JSON bodies but NextAuth form posts and DELETEs are exempt", () => {
  assert.equal(contentTypeAllowed(reqWith({ "content-type": "application/json; charset=utf-8" }), "/api/income"), true);
  assert.equal(contentTypeAllowed(reqWith({ "content-type": "text/plain" }), "/api/income"), false);
  assert.equal(contentTypeAllowed(reqWith({ "content-type": "application/x-www-form-urlencoded" }), "/api/auth/callback/credentials"), true);
  assert.equal(contentTypeAllowed({ method: "GET", headers: { get: () => null } }, "/api/income"), true);
  assert.equal(contentTypeAllowed({ method: "DELETE", headers: { get: () => null } }, "/api/income/1"), true);
  // Body-less POST (demo seed) has no content type at all.
  assert.equal(contentTypeAllowed({ method: "POST", headers: { get: () => null } }, "/api/demo"), true);
  assert.equal(
    contentTypeAllowed(reqWith({ "content-length": "0" }), "/api/demo"),
    true
  );
  // A body without a declared type is still rejected (chunked or declared length).
  assert.equal(contentTypeAllowed(reqWith({ "transfer-encoding": "chunked" }), "/api/income"), false);
  assert.equal(contentTypeAllowed(reqWith({ "content-length": "12" }), "/api/income"), false);
});

test("API and auth requests get the right budgets", () => {
  assert.equal(budgetFor("/api/auth/signup", "POST").limit, 20);
  assert.equal(budgetFor("/api/auth/csrf", "GET").limit, 120);
  assert.equal(budgetFor("/api/insights", "GET").limit, 120);
  assert.equal(budgetFor("/api/insights", "GET", true).limit, 600);
  assert.equal(budgetFor("/dashboard", "GET").limit, 240);
});

const { passwordProblem, passwordFitsBcrypt } = require("../lib/passwordPolicy");

test("bot scanners are blocked without touching the app", () => {
  for (const path of ["/.env", "/.git/config", "/wp-login.php", "/wp-admin/", "/xmlrpc.php", "/phpmyadmin/", "/boaform/admin/formLogin", "/owa/", "/backup.sql", "/index.php"]) {
    assert.equal(isBlockedPath(path), true, path);
  }
  for (const path of ["/", "/dashboard", "/owasp", "/api/income", "/help"]) {
    assert.equal(isBlockedPath(path), false, path);
  }
});

test("password policy rejects weak, reused, and over-long secrets", () => {
  assert.equal(passwordProblem("Short1!"), "Password must be at least 8 characters.");
  assert.equal(passwordProblem("password"), "Choose a less common password.");
  assert.equal(passwordProblem("aaaaaaaa"), "Password cannot be a single repeated character.");
  assert.equal(passwordProblem("Ali@example.com", { email: "ali@example.com" }), "Password cannot be the same as your email address.");
  const long = "a1".repeat(40);
  assert.equal(passwordProblem(long), "Password is too long. Use 72 bytes or fewer.");
  assert.equal(passwordFitsBcrypt(long), false);
  assert.equal(passwordFitsBcrypt("Aimless!Walk91"), true);
  assert.equal(passwordProblem("Aimless!Walk91"), null);
});
