# FamilyFinance — Agent Handoff

## What this is

FamilyFinance is a full-stack household cash-flow planner for Pakistani families (default PKR). It stores real user records, authenticates accounts, and forecasts cash flow with deterministic JavaScript — no AI API and no fabricated results.

## Verified state (2026-11-02)

| Check | Result |
| --- | --- |
| `npm.cmd test` | 70/70 pass |
| `npm.cmd run e2e` | 131/131 pass against a running production server |
| `npm.cmd run verify` | 329/329 assertions pass (count scales with cycle length) |
| `npm.cmd run lint` | clean |
| `npm.cmd run build` | succeeds (Next 15.5.28) |
| Live smoke test | signup → "check your email" → unverified login blocked → verified login → seven-step selection-first onboarding with live preview → dashboard; login routing, signed-in home gate, and income create/duplicate/refresh checked in a browser |
| Node / npm | v24.19.0 / 11.17.0 |
| MongoDB | 9.0, local `mongodb://127.0.0.1:27017/familyfinance` |
| Git | check `git log -1 --oneline` for the current commit |

## Stack

- Next.js 15.5.28 App Router, JavaScript (not TypeScript)
- React 19.3.1, Tailwind 3
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
npm.cmd run verify
```

`.env.local` must contain `MONGODB_URI`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `APP_URL`, and optional `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `ALLOW_INDEXING`. Do not commit it.

Demo account used for the live walkthrough:
`showcase-1793100910046@example.com` / `Showcase123!`

One-time upgrade step (already run locally, 69 accounts marked):
`npm.cmd run verify-backfill`

## What changed in this work cycle

### 1. Income saving fixed end-to-end

Reported bug: first submit appeared to fail with a null/empty response, second submit hit a duplicate error, and the record was missing after refresh.

Root causes and fixes:

1. **React event object used after `await`.** `components/MoneyForm.js` called `event.currentTarget.reset()` after `await onSubmit(body)`. React nulls `currentTarget` when dispatch finishes, so the reset threw even though the API had already returned `201`. Fix: capture `formEl = event.currentTarget` before awaiting, then reset `formEl` (lines 19-29).
2. **New rows hidden by stale page/filter state.** `components/Records.js` reloaded the current page and filters after create. Fix: clear filters, set page 1, and reload with an explicit override; show a “saved — first row below” notice. On a new submit the previous notice is cleared.
3. **List order made new rows hard to find.** `app/api/income/route.js` and `app/api/expenses/route.js` now sort `{ createdAt: -1, _id: -1 }`.
4. **Duplicate prevention already correct.** One POST creates exactly one record; an identical second POST returns `409` (`This income entry already exists for that date.`). Existing partial unique index on `(householdId, occurrenceKey)` remains the database guard.

Verified via API probe and browser: `post1 201`, `post2 409`, row visible immediately and after full page reload.

### 2. Real email verification

Flow:

- Signup validates email shape on the client (input `type="email"`) and server (`emailAddress` in `lib/validation.js`); shape validation never claims the mailbox exists.
- New users are created with `emailVerifiedAt: null` and stay unverified until the link is opened.
- `lib/issueVerification.js` creates a 256-bit random token, stores only its SHA-256 hash, expires it after 24 hours, and retires older unused tokens.
- `models/EmailVerification.js`: `userId`, `tokenHash` (unique), `expiresAt` (TTL index), `usedAt`.
- `app/api/auth/verify-email/route.js` rejects missing/unknown/expired/reused tokens, marks the token used, retires other links, and sets `emailVerifiedAt`.
- `lib/authOptions.js` throws `EmailNotVerified` when the password is correct but the account is unverified. Login is therefore blocked server-side, not only in the UI.
- `app/api/auth/resend-verification/route.js`: 3 requests / 10 min per IP, 1 / min per address, honeypot, generic response for unknown addresses, and an honest `503` when SMTP is absent.
- `lib/mail.js` owns SMTP configuration and Nodemailer delivery for both verification and password reset.
- `app/verify-email/page.js` auto-verifies from `?token=`, handles expired/invalid links, and offers resend.
- `app/login/page.js` shows “Verify your email” plus a resend link for `EmailNotVerified`.
- `app/signup/page.js` shows a “Check your email” state only when delivery actually succeeded; otherwise it states that delivery is not configured.

Migration: `scripts/backfill-email-verified.js` (`npm run verify-backfill`) marks pre-verification accounts as verified once. Already run locally (69 accounts). New signups are unaffected.

Limitation: without `SMTP_HOST`/`SMTP_FROM`, signup succeeds but verification/reset mail returns `503`; the UI must not promise an inbox.

### 3. Selection-first onboarding

`app/(app)/onboarding/page.js` asks for the household plan immediately after signup/login and is built around picking rather than typing:

1. Household — suggested name, city chips (plus a free-text fallback), adult/child/elder steppers, planning start day.
2. Money in — income-source tiles (salary, weekly wage, daily wage, freelance, business, family contribution, other), frequency chips, amount, payday.
3. Essentials — toggle cards for rent, groceries, utilities, internet/phone, transport, school fees (only when children > 0), medicine, and family support; each enabled bill takes an amount and due day. "Add all" and "Clear" shortcuts.
4. Debt — Yes/No tiles; debt-type chips, monthly instalment, due day.
5. Savings — Yes/No tiles, goal presets (emergency fund, home, wedding, education, travel, appliance, custom), amount, target-length chips, one-click suggested monthly saving.
6. Big event — Yes/No tiles, event presets (wedding, Eid, guests, travel, appliance, medical, other), amount, time-away chips.
7. Review — edit-in-place summary cards, optional cash/savings, emergency-reserve choices (1 month, 2 months, none, custom), survival-budget source choices, then confirm.

Behaviour:

- Progress rail with reachable steps, step counter, Back/Continue, "Skip this" on optional steps, inline validation, and a sticky live monthly preview.
- Never re-asks signup data; the household name is prefilled from signup.
- Conditional content: school fees only when children > 0; debt/goal/event details only after "Yes".
- `lib/onboardingPlan.js` is pure and frequency-aware (weekly/daily/yearly → monthly, integer minor units). It only uses typed values; blank fields stay zero, and the preview says so.
- Confirm writes household name/city/members, income, selected bills, debt instalment, goal, event, balances, reserve, survival budget, then `setupComplete: true`.
- In-session retry flags prevent the same item being created twice if a later write fails.
- After login, `/onboarding` opens when `household.setupComplete` is false; otherwise the user goes straight to `/dashboard`.

Verified in a browser end-to-end: Karachi, two adults, salary 150,000/month, rent 45,000, groceries 22,000, credit-card debt 12,000, emergency-fund goal 300,000 over 12 months (suggested saving 25,000), wedding 200,000 in 6 months, cash 80,000, savings 50,000, reserve 79,000. Confirming created exactly one income, two bills, one debt, one goal, and one event (plus the hidden recurring templates), set `setupComplete: true`, and opened a dashboard built from those numbers.

### 4. Security and abuse hardening

- `middleware.js` + `lib/botGuard.js` + `lib/rateLimit.js`:
  - Per-IP sliding windows: auth `20/min`, anonymous API `120/min`, signed-in API `600/min per account`, pages `240/min`, plus a `1500/min` per-IP API ceiling.
  - Escalating bans capped at `15 min` (`MAX_BAN_MS`) so shared NATs are not locked out for hours.
  - Anonymous keying uses the last `X-Forwarded-For` hop, else `x-real-ip`, else `"direct"`. Authenticated traffic is classified with `getToken`.
  - Scanner blocklist returns `404` before the app runs: `/wp-*`, `/boaform|hnap1|gponform`, `/owa|ecp|autodiscover`, `/remote/login`, `.env`/`.git`/`phpmyadmin`, and `*.php|sql|bak`.
  - Same-origin checks, JSON-only `POST/PUT/PATCH`, and a 64 KB body cap via `lib/api.js`.
  - Honeypot fields (`website`) on signup, login, forgot-password, and resend-verification. Login keeps a real bcrypt dummy hash so timing stays flat for unknown accounts.
  - Security headers: CSP, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, COOP, HSTS in production, `poweredByHeader: false`.
  - `/_next/image` deliberately returns `404` (the app uses no `next/image`).
- `lib/passwordPolicy.js`: 8–72 bytes, rejects common/repeated passwords and passwords equal to the email; enforced on signup, reset, and login.
- Password reset retires other outstanding tokens; login has a per-email limiter (10/min) with ban.
- Private pages are `noindex`; indexing is opt-in via `ALLOW_INDEXING`.
- `SECURITY.md` documents controls, deployment requirements, and honest gaps.

### 5. Framework/security upgrade

- Next.js upgraded to **15.5.28** and React/ReactDOM to **19.3.1** (`eslint-config-next@15.5.28`).
- Dynamic route handlers now await params (`const { id } = await params;`) in income/expenses/goals/events/simulate routes.
- Build, lint, and E2E were re-run after the upgrade; critical Next advisories are resolved.

### 6. Demo/example data

- Example data is now visible only to **signed-out** visitors, on the public home page (`components/HomeExample.js`). Signed-in visitors see workspace links instead.
- The signed-in workspace never offers or seeds examples: the dashboard's "Load example month" CTA and its `seed()` call were removed. Empty states now point to onboarding or to adding a first real income/bill.
- The legacy "You are viewing example data / Remove example data" banner still appears only when `household.demoSeededAt` is set, so older demo accounts can clean up.
- The demo API (`POST/DELETE /api/demo`) and its E2E coverage are retained for manual testing and regression tests; no UI path seeds demo data any more.
- Demo month seeds 12 incomes, 38 bills including partials, 5 goals, and 5 events.
- Dashboard has a Savings goals card and six-cycle history.

### 7. Engagement and responsive UI refresh

- Public home page rebuilt: labelled illustrative month preview ("Example data — not yours"), capability tiles, four-step cycle explanation, feature grid, honesty strip, and closing call to action. The example preview is a client component gated by `useSession`, so signed-in visitors see workspace links instead.
- Public header uses a right-side drawer on small screens; desktop keeps the horizontal nav. Footer now groups Product, Account, and Legal links.
- App navigation moved fully to the side: a 64px icon rail (`Home`, `Plan`, `Bills`, `Goals`, `More`) is always visible on mobile, plus a full grouped drawer. The bottom tab bar was removed.
- Shared navigation metadata (`components/nav.js`), inline SVG icons (`components/NavIcon.js`), and UI primitives (`PageHeader`, `StatCard`, `ProgressBar` in `components/ui.js`) keep routes consistent.
- Added KPI summaries and progress bars to plan, reports, goals, events, simulator, survival, settings, income, expenses, and dashboard (cycle progress strip). Plan shows mobile day cards instead of a wide table.
- Contrast pass raised secondary text opacity and replaced low-contrast cyan text with navy text plus cyan graphical accents. Lighthouse on `/`: accessibility 0.96, best practices 1.0, SEO 1.0 (remaining item is colour contrast on the existing white-on-cyan buttons).

## Implemented features

- Auth: signup, login, logout, password reset (SMTP-dependent), rate-limited credentials login
- Email verification: hashed one-time tokens (24h), server-side unverified-login block, rate-limited resend, honest delivery failures, legacy backfill
- Household onboarding: seven selection-first steps (city/income/bill/goal/event presets, chips, steppers), conditional questions, skip where safe, live monthly preview, `setupComplete`; login lands on onboarding until it is complete
- Household settings: members, city, timezone, planning start day, opening/savings/emergency balances
- Income and expenses: CRUD, partial payments with date + note, filters, pagination, CSV export; newest-first with immediate post-save visibility
- Repeating income/bills: hidden schedule template + visible occurrences, propagation, series deletion
- Dashboard: health score, 14-day agenda, cash timeline, category split, six-cycle trend, runway, savings goals; empty states link to onboarding/income/bills and no demo seeding
- Planning engine: daily/weekly/monthly cash flow, shortages, missed essentials, safe-to-spend, explanations
- Goals, special events with affordability verdicts, what-if simulator with saved/replayable scenarios
- Survival budget with city estimates and explanations
- Reports: date/category filters, plan-vs-actual, table view, over-budget categories
- JSON household export, owner-only household delete
- PWA: manifest, service worker (offline fallback + public assets only), install prompt, 192/512/maskable/apple icons
- Workspace shell: desktop sidebar, always-visible mobile side rail, full grouped side drawer (no bottom tabs)
- SEO: robots/sitemap gated by `ALLOW_INDEXING`, canonical/OG metadata, `noindex` on private pages
- Security headers, per-endpoint auth/authorization, rate limits, health endpoints
- Bot/abuse layer: scanner 404s, method allow-list, same-origin + JSON-only writes, per-IP budgets with escalating bans, honeypots

## Important root causes fixed (do not regress)

1. **Compound sparse index blocked the second recurring record.** `{ householdId: 1, occurrenceKey: 1 }` with `sparse: true` indexes every document because `householdId` always exists. Fixed with a **partial** unique index using `{ occurrenceKey: { $type: "string" } }`. Run `npm run repair` on old databases; `npm run indexes` migrates it.
2. **Production login redirect loop over HTTP.** Forcing `__Secure-next-auth.session-token` in production conflicted with middleware cookie selection based on `NEXTAUTH_URL`. Removed the override; HTTPS still gets the `__Secure-` cookie automatically.
3. **Recurring records shown as templates.** Lists, reports, CSV, planner, and payments use occurrences only. Editing an occurrence propagates to its schedule and unpaid future rows; DELETE removes template + future unpaid rows and keeps paid history.
4. **Password hash leakage.** `passwordHash` is `select: false`; login explicitly selects it.
5. **Recurring rows regenerated after delete.** Deleting the template stops `ensureOccurrences` from recreating the series.
6. **Validation gaps.** Strict calendar dates, positive amounts, duplicate one-time records → the existing row with `alreadyExists: true` (idempotent, no duplicate insert), invalid goal/event values → `400`, DELETE with nothing found → `404`.
7. **Health check could lie.** Readiness used to trust a cached Mongoose handle. `connectDb` rebuilds a stale handle and `/api/health/ready` performs an actual `ping()`.
8. **Income reset threw after await.** `event.currentTarget` was read after the request resolved; capture the form element first.
9. **New records were hidden by filters/pages.** Reset to page 1, clear filters, and sort newest-first after create.
10. **Unverified accounts could log in.** Verification is enforced inside `authorize`, not only in the UI.

## Test layout and coverage

- `tests/dates.test.js`, `tests/money.test.js`, `tests/recurring.test.js`, `tests/planning.test.js`, `tests/survival.test.js`
- `tests/insights.test.js`, `tests/csv.test.js`, `tests/validation.test.js`, `tests/security.test.js`, `tests/verification-onboarding.test.js`
- `tests/verification-onboarding.test.js` covers token randomness/hashing, invalid/used/expired token states, email-shape validation, monthly/weekly/daily/yearly conversion, preview totals, shortfall, and blank-field safety.
- `tests/recurring.test.js` covers unique monthly occurrence keys plus real weekly, daily, and yearly pay dates (including a 30-day cycle with five weekly paydays).
- `scripts/e2e.js` covers signup/login/session, malformed-email rejection, unverified-login blocking, verification token lifecycle (unknown/expired/valid/reuse), login after verification, onboarding, recurring income/expense, payments, plan/insights/reports, goals/events/simulator/survival, CSV/JSON export, demo seed/clear, cross-household isolation, security headers, auth redirects, bot/abuse controls (scanner 404, TRACE 405, CSRF 403, 415/413, honeypot, burst 429 + Retry-After), PWA assets, and service-worker cache privacy.
- Test harnesses use a separate simulated IP per client so one bucket is not exhausted; verification tests use test-only DB helpers (`markVerified`, `seedVerifyToken`) against the local MongoDB.
- `scripts/verify-calc.js` (`npm run verify`) seeds a known month and independently recomputes plan totals, the day-by-day balance chain, safe-to-spend, runway, health score, agenda, reports, and the survival budget.

## Manual browser checks performed

- Login/logout with the showcase account.
- Income: created via the form, saw the success notice and the row at the top, repeat submit showed the idempotent “already existed, so it was not duplicated” notice, full reload kept the row.
- Signup: honest “check your email” state with SMTP missing; unverified login shown the verification message and resend link.
- After marking the test account verified in the local DB, login worked.
- Onboarding: all seven steps, conditional school fees, debt/goal/event branches, preset selections, suggestion button, preview math, confirm, dashboard; a fresh signup was routed to onboarding and a completed account to the dashboard.
- Public home: signed out shows the labelled example month; after login the same page shows "You are signed in" and workspace links, with no example figures.
- Verified onboarding results directly in MongoDB: `setupComplete: true`, one income, two bills, one debt, one goal, one event, members, balances, and reserve preserved (plus the hidden recurring templates).
- App navigation at 800px width: side rail links (`Home`, `Plan`, `Bills`, `Goals`, `More`) work; `More` opens the grouped drawer, moves focus to the close button, locks body scroll, and Escape closes it.
- Route sweep at 800px width: dashboard, plan, reports, goals, events, simulator, survival, settings, income, and expenses render their KPIs with no horizontal overflow (`scrollWidth` below `innerWidth`) and no console errors.
- Simulator: submitted an explicit unexpected amount of `0`; comparison showed no change (correct), while a blank amount skips the extra expense entirely.
- Lighthouse on `/`: accessibility 0.96, best practices 1.0, SEO 1.0. The only remaining audit is `color-contrast` on the existing white-on-cyan primary buttons.

## Known limitations (honest)

- Rate limits and plan cache are per-process. Use Redis for multiple instances; the in-process limiter is not a distributed defense.
- Email delivery (verification and reset) requires SMTP. Without it the UI reports that delivery is not configured. No 2FA yet.
- Verification/reset links depend on a correct `APP_URL`/`NEXTAUTH_URL`.
- Onboarding uses separate writes for household, income, bills, debt, goal, event, and final balances. In-session retry flags skip already-created items, but a reload/crash mid-confirm can leave a partial plan; there is no MongoDB transaction.
- Household deletion and recurring-occurrence generation are also not transactional.
- No shared-household invite UI yet (membership roles exist).
- CSP allows `'unsafe-inline'` scripts because Next.js injects hydration bootstrap inline. A nonce-based CSP is future work.
- `npm audit --omit=dev` reports advisories in `next` (transitive `postcss`), `next-auth` (via `nodemailer`), and `nodemailer`; clearing them needs major upgrades.
- Audit log rows are ordinary Mongo documents (not append-only or externally signed).
- The service worker does not cache authenticated data, so there is no offline record access.
- The bundled k6 script covers public routes only; it does not prove production-scale capacity.
- E2E tests the HTTP API and rendered HTML; interactive controls were spot-checked manually, not exhaustively automated.
- The available desktop browser cannot shrink below 800px, so 375px phone rendering was verified through the responsive rules (64px side rail, stacked cards) rather than device emulation.
- White text on the bright-cyan primary buttons remains at 2.8:1 contrast. Changing it would require either a darker button background or navy text, both of which alter the agreed palette/visual language; the cyan accent is otherwise always paired with navy text.

## Deployment notes

- Use HTTPS URLs in `NEXTAUTH_URL`/`APP_URL`; do not hardcode the `__Secure-` cookie prefix.
- Run `npm run repair` once on a database created before the partial occurrence index, then `npm run indexes`.
- Run `npm run verify-backfill` once after deploying email verification to avoid locking out pre-existing accounts.
- Configure SMTP before advertising email verification or password reset.
- Ensure MongoDB backups (`mongodump`/Atlas) and verify restores.
- `ALLOW_INDEXING=true` only on the public production host.
- Put the app behind HTTPS and a reverse proxy/CDN that appends the real peer to `X-Forwarded-For` (or sets `X-Real-IP`); the limiter trusts the last hop.
- Start MongoDB with authentication and bind it to a private interface; the local dev setup has no auth and must not be copied to production.

## Cleanup

Temporary diagnostics (`tmp-*.js`, `tmp-*.log`, `scripts/.tmp-*.js`) are not part of the app and should be removed before committing. Last check: none remain.
