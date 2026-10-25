# FamilyFinance — Agent Handoff

## Project purpose

FamilyFinance is a secure full-stack household cash-flow planner for Pakistani families (default PKR). It must persist data, authenticate users, and calculate forecasts with deterministic JavaScript (no AI required).

## Technology stack (actual)

- Next.js **14.2.15** App Router, **JavaScript** (not TypeScript)
- React 18, Tailwind CSS 3
- MongoDB + Mongoose (being added)
- NextAuth Credentials + bcryptjs (being added)
- Jest/node:test for engine tests (being added)

## Verified current state (this session)

Inspected: `package.json`, `README.md`, `app/page.js`, `app/layout.js`, `app/globals.css`, `tailwind.config.js`, `next.config.mjs`, `.gitignore`. **No `AGENT_HANDOFF.md` existed.** Git status command was slow/unconfirmed.

**Last completed work:** `create-next-app@14.2.15` scaffold (template landing page). `node_modules` was still installing when work resumed.

**Not implemented yet:** auth, MongoDB, models, APIs, planning engine, app pages, SEO content, tests.

## Next action

Implement foundation (theme, money/dates, engine, models, auth, APIs, pages) on this scaffold. Do not run `create-next-app` again.

## Commands

- Install: `npm install`
- Dev: `npm run dev`
- Test: `npm test`
- Build: `npm run build`

## Environment variable NAMES (never values)

`MONGODB_URI`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `ALLOW_INDEXING`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `APP_URL`

## Files modified this session

Handoff created; implementation in progress from empty scaffold.
