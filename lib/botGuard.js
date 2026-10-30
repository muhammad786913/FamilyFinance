/**
 * Cheap, deterministic bot/abuse filtering for the edge middleware.
 * Everything here is pure so it can be unit-tested without a server.
 */

const BLOCKED = [
  /^\/\.(env|git|cvs|svn|hg|aws|ssh|htaccess|htpasswd|DS_Store)/i,
  /^\/wp-/i,
  /^\/(phpmyadmin|pma|myadmin|adminer|mysql|sqladmin)/i,
  /^\/(vendor|phpunit|telescope|actuator|druid|solr|console|jmx-console|_ignition|debugbar)/i,
  /^\/(boaform|hnap1|gponform)(?:$|\/)/i,
  /^\/(owa|ecp|autodiscover)(?:$|\/)/i,
  /^\/remote\/login/i,
  /^\/(\.\.|%2e%2e)/i,
  /\.(php|asp|aspx|jsp|cgi|env|ini|sql|bak|old|swp|git)$/i,
  /^\/(cgi-bin|xmlrpc\.php|server-status|config\.json|credentials|secrets)/i,
];

function isBlockedPath(pathname) {
  return BLOCKED.some((re) => re.test(pathname));
}

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function isStateChanging(method) {
  return WRITE_METHODS.has(String(method || "").toUpperCase());
}

function isAllowedMethod(method) {
  return ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"].includes(
    String(method || "").toUpperCase()
  );
}

function hostOf(value) {
  try {
    return new URL(value).host.toLowerCase();
  } catch {
    return "";
  }
}

/** Same-origin check for state-changing requests. Missing Origin is allowed for
 *  non-browser clients (they cannot be victims of CSRF); a present-but-foreign
 *  Origin, or a browser-declared cross-site request, is rejected. */
function originAllowed(req) {
  const origin = req.headers.get("origin");
  if (origin) {
    const host =
      req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
    if (!host || hostOf(origin) !== host.toLowerCase()) return false;
  }
  const site = req.headers.get("sec-fetch-site");
  if (site === "cross-site") return false;
  return true;
}

/** JSON-only writes for our own APIs (NextAuth posts form bodies to /api/auth).
 *  DELETE carries no body. A body-less POST (e.g. /api/demo) may omit the type. */
const BODY_METHODS = new Set(["POST", "PUT", "PATCH"]);

function contentTypeAllowed(req, pathname) {
  if (!BODY_METHODS.has(String(req.method || "").toUpperCase())) return true;
  if (pathname.startsWith("/api/auth/")) return true;
  const type = (req.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (type === "application/json") return true;
  if (type) return false;
  // No declared type: only permit it when there is provably no body.
  const length = req.headers.get("content-length");
  const chunked = req.headers.get("transfer-encoding");
  return !chunked && (length == null || length === "0");
}

/** Budgets are intentionally generous for humans and tight for loops. */
const BUDGETS = {
  AUTH: { limit: 20, windowMs: 60_000, banMs: 60_000 },
  API_ANON: { limit: 120, windowMs: 60_000, banMs: 30_000 },
  API_AUTH: { limit: 600, windowMs: 60_000, banMs: 30_000 },
  PAGE: { limit: 240, windowMs: 60_000, banMs: 30_000 },
};

function budgetFor(pathname, method, authenticated = false) {
  if (pathname.startsWith("/api/auth/") && isStateChanging(method)) return BUDGETS.AUTH;
  if (pathname.startsWith("/api/")) return authenticated ? BUDGETS.API_AUTH : BUDGETS.API_ANON;
  return BUDGETS.PAGE;
}


module.exports = { isBlockedPath, isStateChanging, isAllowedMethod, originAllowed, contentTypeAllowed, BUDGETS, budgetFor };

