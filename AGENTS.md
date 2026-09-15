# Agent instructions

## Project overview

This is a Next.js 16.2.6 App Router application for tracking Fantasy Premier
League mini-league standings and a weekly winner-takes-all pot. The app uses
React 19, TypeScript, Tailwind CSS 4, shadcn-style components, and libSQL.

The main UI routes are:

- `/` — weekly pot results, overall rankings, balances, settlements, and links to winning gameweeks.
- `/sp` — tracked mini-league snapshots and live-rank checks.
- `/sp/leagues/[leagueId]` — historical snapshots for one tracked league.

The API routes are:

- `/api/snapshot` — finalized gameweek snapshots for all configured leagues.
- `/api/pot/snapshot` — finalized gameweek snapshots for the pot roster.
- `/api/pot/settle` — records the gameweek through which pot balances have been settled; accepts `POST` with a numeric `throughGw` body field.
- `/api/live-rank` — current live rank for one league (`?leagueId=...`) or all configured leagues.

`app/opengraph-image.tsx` generates the dynamic weekly-pot Open Graph image.

## Repository conventions

- Keep all FPL API access in `lib/fpl.ts`.
- Keep league snapshot orchestration in `lib/snapshot.ts`, live-rank logic in `lib/live-rank.ts`, and pot snapshot/roster logic in `lib/pot-snapshot.ts` and `lib/pot-roster.ts`.
- Keep the libSQL client and league snapshot CRUD in `lib/db/index.ts`, the ordered migration definitions in `lib/db/migration.ts`, and migration initialization in `lib/db/init.ts`. Keep pot CRUD and pot calculations in `lib/pot-db.ts`.
- Do not access SQLite/libSQL directly from React components or route UI code; use the database modules.
- Database schema changes belong in migration definitions and must be applied through the existing migration runner. New migrations should be ordered and safe to run through that runner; do not add schema creation, alteration, or backfill logic to CRUD modules. The existing `002_pot_result_status` migration is a historical one-time `ALTER TABLE` and should not be rewritten.
- League and pot configuration belongs in `config/leagues.ts` and `config/pot.ts`; do not hard-code tracked leagues, pot membership rules, or the entry fee in pages and components.
- The pot roster is resolved from the configured source league plus explicit include/exclude IDs, then captured in `pot_members` only when that table is empty. Do not silently re-derive or replace an established roster on every snapshot run.
- Prefer Server Components. Add `"use client"` only for browser interaction, such as buttons, tabs, theme controls, or client-side fetches.
- Preserve the existing Tailwind CSS and shadcn-style component patterns.
- Snapshot jobs must be idempotent, update existing gameweek rows safely, and tolerate partial FPL API failures where possible.
- `/api/snapshot` and `/api/pot/snapshot` are public and support both `GET` and `POST`, so manual buttons and scheduled jobs can use the same endpoints.
- `/api/snapshot` enforces a 3-hour cooldown; `/api/pot/snapshot` enforces a 1-hour cooldown. They use `snapshot_runs` and `pot_snapshot_runs`, respectively. Record a successful run only after its job completes; failed jobs must remain retryable.
- Pot results may be provisional until every roster member’s result for a gameweek is final. Preserve `is_final` behavior when changing pot snapshot, ranking, balance, or UI logic.
- Keep manager/team FPL links pointed at the appropriate history or gameweek event URL when adding or changing pot or standings tables.
- Keep route handlers compatible with Next.js 16 conventions, including promise-based dynamic route `params`.
- Never commit `.env.local`, database credentials, `local.db`, or other local or generated database files.

## Configuration and environment

Local development uses `DATABASE_URL=file:./local.db`. Turso deployments also require `DATABASE_AUTH_TOKEN`. Consult `.env.example` before adding or renaming environment variables, and treat any real token or credential as secret.

## Validation

Use the package manager already specified by the repository (`pnpm`) and run the relevant checks after changes:

```bash
pnpm lint
pnpm typecheck
pnpm build
```

`pnpm format` rewrites TypeScript and TSX files; use it only when formatting changes are intended.

## Next.js guidance

Before changing Next.js APIs or conventions, consult the versioned guidance in `node_modules/next/dist/docs/`, since this project is pinned to Next.js 16.2.6.
