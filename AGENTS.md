# Agent instructions

## Project overview

This is a Next.js 16 App Router application for tracking Fantasy Premier League
mini-league rankings and a weekly pot. The main routes are `/`, `/sp`,
`/sp/leagues/[leagueId]`, `/api/snapshot`, `/api/pot/snapshot`, and
`/api/live-rank`.

## Repository conventions

- Keep FPL API access in `lib/fpl.ts`; keep snapshot orchestration in
  `lib/snapshot.ts`, `lib/live-rank.ts`, and the pot-specific modules.
- Keep the libSQL client and league CRUD exports in `lib/db/index.ts`, migration
  definitions in `lib/db/migration.ts`, and migration initialization in
  `lib/db/init.ts`. Keep pot CRUD in `lib/pot-db.ts`. Do not access SQLite
  directly from React components or route UI code.
- Database schema changes belong in the migration definitions. Use the existing
  migration runner and keep migrations idempotent with `CREATE TABLE IF NOT
  EXISTS`; do not add schema creation, alteration, or backfill logic to CRUD
  modules.
- League and pot configuration belongs in `config/`; do not hard-code tracked
  leagues in pages or components.
- Prefer Server Components. Add `"use client"` only for interactive browser
  behavior such as buttons, tabs, theme controls, or client-side data fetching.
- Preserve the existing Tailwind CSS and shadcn-style component patterns.
- Snapshot work must remain idempotent and resilient to partial FPL API failures.
- `/api/snapshot` and `/api/pot/snapshot` are public and support both `GET` and
  `POST`, allowing manual buttons and scheduled jobs to use the same endpoint.
- Both snapshot endpoints enforce a 3-hour cooldown using their respective
  `snapshot_runs` and `pot_snapshot_runs` tables. Record a successful call only
  after the corresponding job completes; failed calls must remain retryable.
- The `/sp` page displays league snapshots, while the homepage displays pot
  results, winners, balances, and won-gameweek links.
- Keep manager/team FPL links pointed to the appropriate history or gameweek
  event URL when adding or changing pot tables.
- Never commit `.env.local`, database credentials, or generated/local database
  files such as `local.db`.

## Environment

Local development uses `DATABASE_URL=file:./local.db`. Turso deployments also
require `DATABASE_AUTH_TOKEN`. See `.env.example` before adding or renaming
variables.

## Note

Before changing Next.js APIs or conventions, consult the versioned guidance in
`node_modules/next/dist/docs/`, since this project uses Next.js 16.2.6.
