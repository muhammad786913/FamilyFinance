# FamilyFinance

Household cash-flow planner for Pakistani families (default PKR). It stores real records, authenticates users, and forecasts cash using deterministic JavaScript — not an AI API.

## Features

- Sign up, log in, logout, optional password reset (only if SMTP is configured)
- Household onboarding and settings (currency, timezone, planning month, members)
- Income and expense CRUD with edit forms, partial payments, status/category filters, pagination
- Repeating income/bills: one payable occurrence at a time, edits propagate to unpaid future cycles, deleting a row removes the series
- Rich dashboard: cash-flow health score, 14-day agenda, balance timeline, category split, six-cycle trend, runway
- Daily / weekly / monthly cash-flow engine
- Goals, special events, what-if simulator with saved scenarios, reports with date/category filters
- Minimum survival budget (user costs + optional city estimates)
- CSV export of income/expenses, full JSON household export
- Clearly labelled, removable example (demo) data
- Installable PWA (manifest, service worker, offline fallback, install prompt) and a mobile drawer/bottom-tab layout
- Public SEO pages; private app routes require authentication (`noindex`)

## Stack

Next.js 14 (JavaScript), React 18, Tailwind CSS, MongoDB, Mongoose, NextAuth Credentials, bcryptjs.

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
| `npm run lint` | ESLint |
| `npm run build` | Production build |
| `npm start` | Run production server |
| `npm run indexes` | Ensure MongoDB indexes (needs `.env.local`) |
| `npm run repair` | One-off repair for pre-`occurrenceKey` databases (safe to re-run) |

For E2E, start MongoDB and `npm start`, then run `npm run e2e` in another terminal. It creates throwaway users (`e2e-*@example.com`) and checks auth, isolation, CRUD, recurrence, payments, exports, PWA files, and security headers.

## Repeating records

Repeating income and bills are stored twice: a hidden **schedule template** and the **materialised occurrence** rows that you actually see and pay. Only occurrences appear in lists, reports, CSV, and the planner.

- Editing an occurrence updates its schedule and all unpaid future occurrences.
- Payments always land on the occurrence, never on the hidden template.
- Deleting an occurrence deletes the series (the template plus future unpaid/unreceived rows). Already-paid history is kept.
- A **partial** unique index on `(householdId, occurrenceKey)` prevents duplicate occurrences. The old `sparse` index was wrong for compound keys because `householdId` is always present; run `npm run repair` on an existing database to migrate it.

## Demo data

The dashboard offers "Load example data". It seeds two planning cycles of clearly labelled examples (`isDemo: true`, notes say "Example data"), goals, events, and survival figures. It is user-initiated, refuses to load twice, and "Remove example data" deletes only demo rows and restores household fields you have not edited. Nothing is silently presented as your own data.

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

- Passwords hashed with bcryptjs (cost 12)
- JWT sessions, httpOnly cookies, `secure` in production
- Authorization on every financial API via household membership
- Rate limits on auth and write endpoints (per process; use Redis at multi-instance scale)
- Security headers in `next.config.mjs`
- Export and owner-only household delete in Settings

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
- Email verification is not implemented; password reset requires SMTP. Without SMTP the API says so instead of pretending to send mail.
- Automated coverage is 39 unit tests plus a 106-check end-to-end suite (`npm run e2e`) against a running server. Browser UI checks are manual; the E2E suite tests the HTTP API and rendered HTML, not every interactive control.
- Household deletion and recurring-occurrence generation use separate writes, not a MongoDB transaction, so a crash mid-operation can leave partial state.
- The service worker provides only an offline fallback page. It deliberately does not cache records or API responses, so there is no offline data entry.
- `npm audit` still reports advisories for the Next 14 line (fixed only in Next 16, a breaking migration) and for `nodemailer <= 10.1.3`. `next-auth@4.24.15` requires `nodemailer ^7.0.7`, so the nodemailer advisory cannot be removed without replacing or upgrading the auth stack. Do not expose SMTP credentials beyond what the reset flow needs.
- Example (demo) data is an explicit product feature, not seed production data. It is labelled, user-initiated, and removable.

## License

Private project unless the owner specifies otherwise.
