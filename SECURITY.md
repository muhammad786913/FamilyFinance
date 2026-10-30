# Security notes

FamilyFinance stores household money records, so the default posture is "private by default, cheap to defend, honest about gaps".

## What is enforced

| Area | Control |
| --- | --- |
| Pages | Every private page is gated by `next-auth/middleware`; the E2E suite asserts an anonymous `/dashboard` redirects. |
| Sessions | NextAuth JWT (7 days), `HttpOnly` + `SameSite=Lax`; `__Secure-` prefix is automatic on HTTPS. |
| Login | Per-email limit (10/min) + escalating ban, per-IP auth budget, bcrypt cost 12, constant-time-ish dummy compare for unknown accounts, no user enumeration. |
| Signup / reset | Per-IP limits, honeypot field, generic error text, tokens hashed (SHA-256) with 1h expiry and retired after use. Passwords must be 8-72 bytes, are rejected when common, repeated, or equal to the email, and are capped because bcrypt ignores bytes past 72. |
| Writes | Same-origin `Origin`/`Sec-Fetch-Site` check, JSON-only bodies (except NextAuth form posts), 64 KB body cap. |
| Bots / scanners | Blocklist for `/.env`, `/.git`, `/wp-admin`, `/phpmyadmin`, `*.php|sql|bak`, etc. → 404 without touching the app. Non-standard methods (TRACE/TRACK/CONNECT) are rejected; Next's edge runtime refuses TRACE before it reaches the handler, so it is never served. |
| Floods | Per-IP sliding windows: auth 20/min, API 600/min, pages 240/min; repeat offenders are banned for 30-60 s and the ban doubles on each repeat, capped at 15 min so a shared NAT is not locked out for hours. |
| Headers | CSP, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, `COOP`, HSTS in production, `poweredByHeader: false`. |
| Data access | Every API route re-checks session + household membership server-side; cross-household reads are tested in E2E. |
| Privacy | Service worker never caches `/api/*` or authenticated HTML; API responses are `no-store`; indexing is opt-in via `ALLOW_INDEXING`. |
| Secrets | Only `.env.local` (gitignored); no secrets in the repo or client bundle. |

## Deployment requirements

1. Put the app behind HTTPS and a reverse proxy/CDN.
2. Make the proxy **append** the real peer to `X-Forwarded-For` (or set `X-Real-IP`). The limiter uses the **last** hop, so client-supplied leading values cannot choose their own bucket. Never expose the Node port directly to the internet.
3. Start MongoDB with authentication and bind it to a private interface; the current local dev setup has no auth and must not be copied to production.
4. Set a strong `NEXTAUTH_SECRET`; rotate it to invalidate all sessions.
5. For more than one app instance, move rate limits and the plan cache to Redis — the current store is per-process, so N instances multiply every budget by N.
6. Keep `ALLOW_INDEXING` unset/false on private or staging hosts.

## Known gaps (not marketing)

- No CAPTCHA or WAF. Honeypot + limits + origin checks stop naive bots and credential stuffing, not a determined distributed attacker.
- Rate limits are in-memory: a restart clears them, and multiple instances do not share them.
- CSP allows `'unsafe-inline'` scripts because Next.js injects hydration bootstrap inline. A nonce-based CSP is future work.
- No email verification and no 2FA.
- Audit log rows are ordinary Mongo documents (not append-only / externally signed).
- The bundled k6 script covers public routes only; no sustained attack simulation has been run.

## Quick verification

```powershell
npm.cmd test                 # 49 unit tests, includes limiter/bot-guard rules
npm.cmd run e2e              # includes scanner 404, TRACE 405, CSRF 403, 415/413, honeypot, burst 429
npm.cmd run verify           # independent recomputation of every money output
curl.exe -sI http://localhost:3000/ | Select-String "content-security-policy|x-frame|strict-transport"
```
