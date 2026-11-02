# FamilyFinance

Household cash-flow planner for Pakistani families (default PKR). It stores real records, authenticates users, and forecasts cash using deterministic JavaScript — not an AI API.

## Features

- Sign up, log in, logout, email verification, optional password reset (only if SMTP is configured)
- Household onboarding (seven selection-first steps with conditional questions and a live monthly preview) and settings (currency, timezone, planning month, members); login lands on onboarding until setup is complete
- Income and expense CRUD with edit forms, partial payments, status/category filters, pagination
- Repeating income/bills: one payable occurrence at a time, edits propagate to unpaid future cycles, deleting a row removes the series
- Rich dashboard: cash-flow health score, 14-day agenda, balance timeline, category split, six-cycle trend, runway
- Daily / weekly / monthly cash-flow engine
- Goals, special events, what-if simulator with saved scenarios, reports with date/category filters
- Minimum survival budget (user costs + optional city estimates)
- CSV export of income/expenses, full JSON household export
- Example month on the public home page, shown only to signed-out visitors; the signed-in workspace never seeds or displays example records
- Installable PWA (manifest, service worker, offline fallback, install prompt) and side navigation on every screen size (icon rail + drawer on mobile, sidebar on desktop)
- Public home page with a labelled example month for signed-out visitors (signed-in visitors see workspace links), feature grid, and four-step walkthrough; KPI cards and progress bars across the workspace routes
- Public SEO pages; private app routes require authentication (`noindex`)

## Stack

Next.js 15.5.28 (JavaScript), React 19, Tailwind CSS, MongoDB, Mongoose, NextAuth Credentials, bcryptjs.

## Project handoff

See [`AGENT_HANDOFF.md`](AGENT_HANDOFF.md) for the full work log: root causes, email-verification design, onboarding flow, security/rate-limit details, test layout, browser checks, deployment notes, and honest limitations.

Current verified state: **76 unit tests**, **131 E2E checks**, **329 independent calculation assertions**, lint clean, and a successful production build on Next 15.5.28 / React 19.

## Prerequisites

- Node.js 18+
- MongoDB 6+ (local or Atlas)

## Installation

```bash
npm install
copy .env.example .env.local
```

Set `MONGODB_URI` and a long `NEXTAUTH_SECRET`. Never commit `.env.local`.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm test` | Unit tests for money, dates, engine, insights, CSV, validation |
| `npm run e2e` | End-to-end API/browser-flow checks against a running server |
| `npm run verify` | Recomputes plan totals, daily balances, safe-to-spend, runway, health score, agenda, reports, and survival from a seeded month and compares them with the API |
| `npm run lint` | ESLint |
| `npm run build` | Production build |
| `npm start` | Run production server |
| `npm run indexes` | Ensure MongoDB indexes (needs `.env.local`) |
| `npm run repair` | One-off repair for pre-`occurrenceKey` databases (safe to re-run) |
| `npm run verify-backfill` | One-off: marks accounts created before email verification as verified (run once after upgrading) |

For E2E, start MongoDB and `npm start`, then run `npm run e2e` in another terminal. It creates throwaway users (`e2e-*@example.com`) and checks auth (including unverified-login blocking and one-time verification tokens), isolation, CRUD, recurrence, payments, exports, PWA files, and security headers. `npm run verify` seeds one month of known income and bills (including a partial payment), then re-derives every displayed figure independently and fails on any mismatch.

## Email verification

New accounts stay unverified until they open the emailed link. Tokens are 256-bit random values stored only as SHA-256 hashes, expire after 24 hours, and are retired on use or resend. Login is blocked server-side for unverified accounts, and resend is rate-limited. Without `SMTP_HOST`/`SMTP_FROM`, signup succeeds but reports honestly that delivery is not configured (no "check your inbox" claim). Run `npm run verify-backfill` once when upgrading an existing database so pre-verification accounts are not locked out.

## Repeating records

Repeating income and bills are stored twice: a hidden **schedule template** and the **materialised occurrence** rows that you actually see and pay. Only occurrences appear in lists, reports, CSV, and the planner.

- Editing an occurrence updates its schedule and all unpaid future occurrences.
- Payments always land on the occurrence, never on the hidden template.
- Deleting an occurrence deletes the series (the template plus future unpaid/unreceived rows). Already-paid history is kept.
- A **partial** unique index on `(householdId, occurrenceKey)` prevents duplicate occurrences. The old `sparse` index was wrong for compound keys because `householdId` is always present; run `npm run repair` on an existing database to migrate it.

## Example data

Example numbers appear only on the public home page, and only for signed-out visitors (`components/HomeExample.js`). They are labelled "Example data — not yours". After login, the public page shows workspace links and the app itself never loads or offers example records; the dashboard empty states link to onboarding, income, and bills instead.

The `POST/DELETE /api/demo` API and its E2E coverage remain for manual testing and regression checks. Accounts seeded by older versions still see the "You are viewing example data" banner with a one-click "Remove example data" action that deletes only demo rows.

## PWA / install

`app/manifest.js` and `public/sw.js` make the app installable. Icons are generated locally into `public/icons/` by `npm run icons` (`scripts/generate-icons.js`) — no remote image hosts.

- Android/Chrome: open the site, use the browser's **Install app** action or the in-app install prompt.
- iPhone/iPad Safari: **Share → Add to Home Screen**.
- Desktop Chrome/Edge: install icon in the address bar.

The service worker only precaches the offline fallback and public static assets. It **never** caches authenticated HTML, API responses, or financial data, so the app cannot show another user's cached data after logout. Offline mode shows a fallback page; it does not provide offline access to records.

## Environment variable names

`MONGODB_URI`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `APP_URL`, `ALLOW_INDEXING`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`

Password reset emails are **not** sent unless SMTP is configured. The API reports that honestly.

Set `ALLOW_INDEXING=true` only on the public production host. Staging should stay unindexed.

## Financial assumptions

- Amounts are stored as integer minor units (paisa). Conversion from major units uses round half-up.
- Received income is added once on the received date. Expected income is projected only.
- Unpaid bills keep their original due date. Passing the due date does not mark them paid.
- Suggested daily spend is an estimate after reserve and essentials due before the next confirmed income.
- Projections are not guaranteed outcomes.
- Survival budget never uses a single poverty-line cutoff as a verdict.

## Security

See `SECURITY.md` for the full list and the deployment requirements.

- Passwords hashed with bcryptjs (cost 12); a shared policy rejects weak, repeated, email-identical, and over-72-byte secrets; unknown accounts still run a dummy compare
- JWT sessions, httpOnly cookies, `secure` automatic on HTTPS
- Authorization on every financial API via household membership
- Edge middleware: scanner paths → 404, non-standard methods rejected (TRACE is never served), cross-origin and non-JSON writes → 403/415
- Per-identity sliding windows (auth 20/min, anonymous API 120/min, signed-in API 600/min, pages 240/min, 1500/min per-IP ceiling) with escalating bans; per-email login limit
- Honeypot fields on signup, login, and password reset
- 64 KB JSON body cap; CSP, HSTS (production), COOP, nosniff, frame-deny headers
- Rate limits are per process; use Redis at multi-instance scale

## Deployment

1. Provision MongoDB (replica set recommended in production).
2. Set environment variables on the host. Use an **HTTPS** URL in `NEXTAUTH_URL` / `APP_URL`; the session cookie becomes `__Secure-` automatically and middleware matches it. On plain HTTP (local preview), NextAuth uses the unprefixed cookie — do not force the secure prefix in code.
3. `npm run build && npm start` or use a Node host (Vercel, Render, etc.).
4. Run `npm run indexes` once. If the database predates the partial occurrence index, run `npm run repair` first.
5. Health: `GET /api/health` liveness, `GET /api/health/ready` database.

### Backup

Take MongoDB snapshots (Atlas backups or `mongodump`) on a schedule. Restore with `mongorestore` into a new database, then point `MONGODB_URI` at it after verification.

## Load testing

Install [k6](https://k6.io/) separately, start the app, then:

```bash
k6 run -e BASE_URL=http://localhost:3000 scripts/load-test.k6.js
```

This script hits public health/home routes. It does **not** prove million-user capacity. Horizontal scale needs a shared session/rate-limit store, MongoDB indexes/sharding as measured, and a CDN for static assets.

## Known limitations

- Rate limiting and plan cache are in-process (not shared across instances). Use Redis for multi-instance deployments.
- Shared household invites beyond a single owner membership are not a full invite UI yet (roles exist on memberships).
- The included k6 script exercises public and health routes only; it does not prove production-scale capacity.
- Email verification requires SMTP. Without SMTP, signup and resend report that delivery is not configured rather than claiming mail was sent.
- Automated coverage is 76 unit tests plus a 131-check end-to-end suite (`npm run e2e`) against a running server. Browser UI checks are manual; the E2E suite tests the HTTP API and rendered HTML, not every interactive control.
- Household deletion and recurring-occurrence generation use separate writes, not a MongoDB transaction, so a crash mid-operation can leave partial state.
- The service worker provides only an offline fallback page. It deliberately does not cache records or API responses, so there is no offline data entry.
- `npm audit --omit=dev` still reports advisories in `next` (transitive `postcss`), `next-auth` (via `nodemailer`), and `nodemailer`; clearing them needs major upgrades. `next-auth@4.24.15` requires `nodemailer ^7.0.7`, so the nodemailer advisory cannot be removed without replacing or upgrading the auth stack. Do not expose SMTP credentials beyond what verification/reset need.
- Example data is confined to the signed-out public home page. The demo API remains an explicit testing/cleanup tool, not seed production data, and the signed-in workspace never presents it as real.
- User-entered money is capped at Rs 1 trillion per field. Above that, the API returns a validation error and the onboarding preview shows "too large" instead of an approximate answer. The cap keeps every cent exact and every monthly plan inside the safe-integer range.

## License

Private project unless the owner specifies otherwise.
