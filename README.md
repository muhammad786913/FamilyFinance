# FamilyFinance

Household cash-flow planner for Pakistani families (default PKR). It stores real records, authenticates users, and forecasts cash using deterministic JavaScript — not an AI API.

## Features

- Sign up, log in, logout, optional password reset (only if SMTP is configured)
- Household onboarding and settings (currency, timezone, planning month)
- Income and expense CRUD, partial payments, recurring occurrences with unique keys
- Daily / weekly / monthly cash-flow engine
- Goals, special events, what-if simulator, reports
- Minimum survival budget (user costs + optional city estimates)
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
| `npm test` | Unit tests for money, dates, engine |
| `npm run lint` | ESLint |
| `npm run build` | Production build |
| `npm start` | Run production server |
| `npm run indexes` | Ensure MongoDB indexes (needs `.env.local`) |

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
2. Set environment variables on the host (HTTPS URL in `NEXTAUTH_URL` / `APP_URL`).
3. `npm run build && npm start` or use a Node host (Vercel, Render, etc.).
4. Run `npm run indexes` once.
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

- Rate limiting and plan cache are in-process (not shared across instances).
- Shared household invites beyond a single owner membership are not a full invite UI yet (roles exist on memberships).
- Load tests have not been run against a production-sized cluster in this repository.
- Email verification is not implemented; password reset requires SMTP.

## License

Private project unless the owner specifies otherwise.
