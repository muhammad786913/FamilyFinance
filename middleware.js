import { NextResponse } from "next/server";
import nextAuthMiddleware from "next-auth/middleware";
import { getToken } from "next-auth/jwt";
import { rateLimit, clientIp, retryAfterSeconds } from "./lib/rateLimit";
import {
  isBlockedPath,
  isAllowedMethod,
  isStateChanging,
  originAllowed,
  contentTypeAllowed,
  budgetFor,
} from "./lib/botGuard";

// Pages that must never render without a session.
const PROTECTED = [
  /^\/dashboard(?:\/|$)/,
  /^\/income(?:\/|$)/,
  /^\/expenses(?:\/|$)/,
  /^\/plan(?:\/|$)/,
  /^\/goals(?:\/|$)/,
  /^\/events(?:\/|$)/,
  /^\/simulator(?:\/|$)/,
  /^\/reports(?:\/|$)/,
  /^\/survival(?:\/|$)/,
  /^\/settings(?:\/|$)/,
  /^\/onboarding(?:\/|$)/,
];

function deny(status, headers = {}, body = null) {
  return new NextResponse(body, {
    status,
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...headers },
  });
}

export default async function middleware(req, event) {
  const { pathname } = req.nextUrl;
  const method = req.method;

  // 1. Scanner/noise paths never reach the application.
  if (isBlockedPath(pathname)) return deny(404);

  // 1b. The app ships no next/image usage, so the optimizer is pure attack
  //     surface (it has carried unauthenticated RCE advisories). Keep it off.
  if (pathname.startsWith("/_next/image")) return deny(404);

  // 2. Reject exotic methods outright (TRACE/TRACK/CONNECT...).
  if (!isAllowedMethod(method)) return deny(405, { Allow: "GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS" });

  // 2b. A signed-in visitor should never land back on the login or signup screen.
  if (pathname === "/login" || pathname === "/signup") {
    let session = null;
    try {
      session = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    } catch {
      session = null;
    }
    if (session?.sub) return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // 3. Cross-site write protection (CSRF defence in depth on top of SameSite cookies).
  if (isStateChanging(method)) {
    if (!originAllowed(req)) return deny(403, {}, "Cross-origin request blocked");
    if (!contentTypeAllowed(req, pathname)) return deny(415, {}, "Expected application/json");
  }

  // 4. Per-identity budgets: strict for anonymous traffic, generous (but finite)
  //    for a signed-in account, plus a hard per-IP ceiling.
  const ip = clientIp(req);
  let token = null;
  if (pathname.startsWith("/api/") && !pathname.startsWith("/api/auth/")) {
    try {
      token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    } catch {
      token = null;
    }
  }
  const authenticated = !!token?.sub;
  const budget = budgetFor(pathname, method, authenticated);
  const bucket = pathname.startsWith("/api/") ? "api" : "page";
  const identity = authenticated ? `user:${token.sub}` : `ip:${ip}`;
  const rl = rateLimit(`${identity}:${bucket}`, budget);
  if (!rl.ok) {
    return deny(429, { "Retry-After": String(retryAfterSeconds(rl)) }, "Too many requests");
  }
  if (pathname.startsWith("/api/")) {
    const ipCap = rateLimit(`ipcap:${ip}:api`, {
      limit: 1500,
      windowMs: 60_000,
      banMs: 30_000,
    });
    if (!ipCap.ok) {
      return deny(429, { "Retry-After": String(retryAfterSeconds(ipCap)) }, "Too many requests");
    }
  }

  // 5. Private pages still authenticate through NextAuth's middleware.
  if (PROTECTED.some((re) => re.test(pathname))) return nextAuthMiddleware(req, event);

  const res = NextResponse.next();
  if (pathname.startsWith("/api/")) res.headers.set("Cache-Control", "private, no-store");
  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|favicon.ico|icons/|sw.js|manifest.webmanifest|.*\\.(?:png|jpg|jpeg|svg|ico|webp|txt|xml|woff2?)$).*)",
  ],
};
