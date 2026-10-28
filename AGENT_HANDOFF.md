# FamilyFinance — Agent Handoff

## What this is

FamilyFinance is a full-stack household cash-flow planner for Pakistani families (default PKR). It stores real user records, authenticates accounts, and forecasts cash flow with deterministic JavaScript — no AI API and no fabricated results.

## Verified state (2026-10-28)

| Check | Result |
| --- | --- |
| `npm.cmd test` | 39/39 pass |
| `npm.cmd run e2e` | 106/106 pass against a running production server |
| `npm.cmd run lint` | clean |
| `npm.cmd run build` | succeeds (Next 14.2.35) |
| Live smoke test | signup, login, onboarding, dashboard, API flows, PWA files verified |
| Node / npm | v24.19.0 / 11.17.0 |
| MongoDB | 9.0, local `mongodb://127.0.0.1:27017/familyfinance` |

## Stack

- Next.js 14.2.35 App Router, JavaScript (not TypeScript)
- React 18.3.1, Tailwind 3
- MongoDB + Mongoose 8.x
- NextAuth 4.24.15 Credentials, bcryptjs 2.4.3 (cost 12)
- nodemailer 7.x (peer-required by next-auth)
- PWA: manifest + service worker + locally generated icons
- Tests: Node built-in test runner + `scripts/e2e.js`

## Run locally

```powershell
# 1. MongoDB (no Windows service required)
& 'C:\Program Files\MongoDB\Server\9.0\bin\mongod.exe' `
  --dbpath C:\Users\ALI\AppData\Local\Temp\opencode\mongo-data `
  --port 27017 --bind_ip 127.0.0.1

# 2. App (separate terminal)
npm.cmd run build
npm.cmd start

# 3. Verification (separate terminal)
npm.cmd test
npm.cmd run e2e
```

`.env.local` must contain `MONGODB_URI`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `APP_URL`, and optional SMTP/`ALLOW_INDEXING` values. Do not commit it.

Demo account used for the live walkthrough:
`showcase-1793100910046@example.com` / `Showcase123!`

## Important root causes fixed (do not regress)

1. **Compound sparse index blocked the second recurring record.** `schema.index({ householdId: 1, occurrenceKey: 1 }, { unique: true, sparse: true })` does not do what it looks like: because `householdId` is always present, MongoDB indexes every document, treating a missing `occurrenceKey` as `null`. Result: only one template per household. Fixed with a **partial** unique index:
   `{ occurrenceKey: { $type: "string" } }`.
   Run `npm run repair` on old databases; `npm run indexes` also migrates the old index.
2. **Production login redirect loop over HTTP.** `authOptions` forced `__Secure-next-auth.session-token` when `NODE_ENV=production`, but `next-auth/middleware` chooses the cookie name from `NEXTAUTH_URL` (HTTPS or not). Over plain HTTP the middleware looked for `next-auth.session-token` and denied every request. Removed the custom cookie override; NextAuth now matches its middleware. On HTTPS it still uses the `__Secure-` cookie automatically.
3. **Recurring records were shown/edited as templates.** The model is: a hidden schedule template + materialised occurrence rows. Lists, reports, CSV, planner and payments only use occurrences. Editing an occurrence propagates name/amount/category/priority/notes to the schedule and unpaid future occurrences. DELETE removes the series (template + future unpaid rows); paid history is kept.
4. **Password hash leaking.** `passwordHash` is `select: false`; login explicitly selects it.
5. **Recurring rows regenerated after delete.** Deleting the template prevents `ensureOccurrences` from recreating the series.
6. **Validation gaps.** Strict calendar dates, positive amounts, duplicate one-time records → 409, invalid goal/event values → 400, DELETE with nothing found → 404.

## Implemented features

- Auth: signup, login, logout, password reset (only sends mail when SMTP is configured), rate-limited credentials login
- Household onboarding/settings: members, city, timezone, planning start day, opening/savings/emergency balances
- Income and expenses: CRUD, partial payments with date + note, filters, pagination, CSV export
- Repeating income/bills with schedule propagation and series deletion
- Dashboard: health score ring, 14-day agenda, cash timeline, category split, six-cycle trend, runway, demo-data CTA
- Planning engine: daily/weekly/monthly cash flow, shortages, missed essentials, safe-to-spend suggestions, explanations
- Goals, special events with affordability verdicts, what-if simulator with saved/replayable scenarios
- Survival budget with city estimates and transparent explanations
- Reports: date/category filters, plan-vs-actual, table view, over-budget categories
- JSON household export, owner-only household delete
- Example data: labelled, one-click load/remove, refuses a second load, restores only untouched household fields
- PWA: installable manifest, service worker (offline fallback + public static assets only), install prompt, 192/512/maskable/apple icons
- Mobile shell: desktop sidebar, hamburger drawer, 5-item bottom tab bar, safe areas
- SEO: robots/sitemap gated by `ALLOW_INDEXING`, canonical/OG metadata, `noindex` on private pages
- Security headers, per-endpoint auth/authorization, rate limits, health endpoints

## Test layout

- `tests/dates.test.js`, `tests/money.test.js`, `tests/recurring.test.js`, `tests/planning.test.js`, `tests/survival.test.js`
- `tests/insights.test.js`, `tests/csv.test.js`, `tests/validation.test.js`
- `scripts/e2e.js` covers signup/login/session, onboarding, recurring income/expense, payments, plan/insights/reports, goals/events/simulator/survival, CSV/JSON export, demo seed/clear, cross-household isolation, security headers, auth redirects, PWA assets, service-worker cache privacy

## Known limitations (honest)

- Rate limits and plan cache are per-process. Use Redis for multiple instances.
- No shared-household invite UI yet (membership roles exist).
- `npm audit` reports Next 14 advisories (only fixed in Next 16, a breaking migration) and nodemailer ≤10.1.3 advisories blocked by `next-auth` peer `^7.0.7`.
- Email verification is not implemented; password reset needs SMTP.
- Multi-document writes (household delete, occurrence generation) are not transactional; a crash can leave partial state.
- The service worker does not cache authenticated data, so no offline record access.
- E2E tests the HTTP API and rendered HTML; interactive browser controls still need manual spot checks.

## Deployment notes

- Use HTTPS URLs in `NEXTAUTH_URL`/`APP_URL`; do not hardcode the `__Secure-` cookie prefix.
- Run `npm run repair` once on a database created before the partial occurrence index, then `npm run indexes`.
- Ensure MongoDB backups (`mongodump`/Atlas) and verify restores.
- `ALLOW_INDEXING=true` only on the public production host.

## Cleanup

Temporary diagnostics (`tmp-*.js`, `tmp-*.log`) are not part of the app and should be removed before committing.
