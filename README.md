# Rackem Leagues

Web app for running amateur pool billiard leagues — match scheduling, lineup
locking, scoring, captain workflows, multi-org support, and the BCA / Fargo /
custom handicap systems that real pool leagues use.

React + TypeScript + Vite on the front end, Supabase (Postgres + Auth +
Realtime) on the back end. Local dev runs entirely against a local Supabase
instance via the Supabase CLI.

---

## Local development setup

### Prerequisites

- **Node 18+** and **pnpm** (`npm install -g pnpm`)
- **Docker Desktop** (Supabase CLI runs Postgres + GoTrue + the rest in
  containers — no Docker, no local Supabase)
- **Git**

### First-time setup

```bash
# 1. Clone + install dependencies
git clone <repo-url>
cd rackem-leagues
pnpm install

# 2. Start the local Supabase stack (takes 30-60s the first time)
pnpm db:start

# 3. Apply migrations (re-runs every time you reset)
pnpm db:reset

# 4. Seed the local DB with a usable dev environment.
#    Open Supabase Studio: http://localhost:54323
#    SQL Editor → paste the contents of database/dev_starting_point.sql → Run
#    See "What dev_starting_point.sql gives you" below.

# 5. Start the Vite dev server
pnpm dev
#    App: http://localhost:5173
```

Sign in at `/login` with the credentials below.

### Default dev login

All passwords are `password`.

| Email | Name | Role |
|---|---|---|
| `dev@test.com` | Lee Goperator (Lo) | League Operator of Tester Org. Captain of Team 3 in every league. |
| `cap1@test.com` | Johnny Captain | Captain of Team 1 in every league. |
| `cap2@test.com` | Captain Smith (Smitty) | Captain of Team 4 in every league. |
| `cap3@test.com` | Sally Captain (Sal) | Captain of Team 2 in every league. |

### What `dev_starting_point.sql` gives you

A fully populated dev environment so you can poke at the app immediately
without filling out registration / profile / LO-application forms by hand.

- **Tester Org** with mock Stripe payment-verified (no need to redo the LO
  application)
- **Sams's Billiards** venue (4 bar-box tables)
- **3 leagues**, each with a 16-week season + season-end-break + playoffs:
  - "3v3 old school" — 8-Ball Tuesday — starts today
  - "Standard 5v5" — 8-Ball Wednesday — starts today+1 (percentage handicap)
  - "Fargo 5v5" — 8-Ball Thursday — starts today+2 (fargo handicap)
- **4 teams per league**, each rostered with captain + 4 unique placeholder
  players (no roster overlap across leagues)
- **~102 matches** scheduled across the 3 seasons (match_lineups auto-created
  by trigger)
- **130 placeholder members** in the pool — Florida-spread realistic names,
  used for filling rosters and exercising captain-search / player-lookup UX

The file lives at `database/dev_starting_point.sql`. It's safe to re-run any
time — it cleans up its own state at the top before re-inserting. After a
`pnpm db:reset`, just paste it again.

> **Heads-up:** `dev_starting_point.sql` only runs against the local Postgres
> database (the DO block at the top refuses anything else). Never run it
> against a hosted Supabase project.

### Re-running from scratch

If your local DB drifts or breaks:

```bash
pnpm db:reset                                        # nukes + re-applies migrations
# then re-paste database/dev_starting_point.sql      # rebuilds dev environment
```

---

## Useful commands

| Command | What it does |
|---|---|
| `pnpm dev` | Start the Vite dev server (http://localhost:5173) |
| `pnpm build` | Production build (`tsc -b && vite build`) |
| `pnpm lint` | Run ESLint |
| `pnpm test` | Run unit tests (Vitest) — watch mode |
| `pnpm test:run` | Run unit tests once |
| `pnpm db:start` | Start local Supabase containers |
| `pnpm db:stop` | Stop local Supabase containers |
| `pnpm db:reset` | Wipe + re-apply migrations + regenerate TypeScript types |
| `pnpm db:types` | Regenerate `src/types/database.types.ts` only |
| `pnpm test:e2e` | Run Playwright E2E tests (see `tests/e2e/README.md`) |
| `pnpm test:e2e:demo` | Run E2E tests in slow-motion + headed (for sales reels) |
| `pnpm e2e:setup` | Set up the dedicated E2E test foundation (separate from `dev_starting_point.sql`) |

Local Supabase URLs after `pnpm db:start`:

- API: http://localhost:54321
- Studio: http://localhost:54323
- Postgres: postgresql://postgres:postgres@localhost:54322/postgres
- Mailpit (email testing): http://localhost:54324

---

## Project structure

```
src/                    React app (TypeScript)
  api/                  Supabase queries, mutations, hooks
  components/           Shared UI components (most are shadcn/ui based)
  hooks/                React hooks (lineup, scoring, etc)
  navigation/           Route definitions (NavRoutes.tsx is source of truth)
  operator/             League-operator pages
  player/               Player-facing pages (dashboard, match views, etc)
  pages/                Standalone routes
  realtime/             Supabase Realtime subscription wiring
  types/                Generated database types + domain types
  wizards/              Multi-step wizard flows (league creation, etc)

supabase/
  migrations/           Database migrations (timestamped, ordered)
  seed_test_users.sql   Older RLS-test users (separate from dev seed below)

database/
  dev_starting_point.sql        ← THE dev seed (this is what you paste)
  dev_bootstrap_full.sql        Older / legacy bootstrap (don't use unless you know why)
  dev_bootstrap_lo.sql          Older / legacy bootstrap
  seed_fake_members.sql         150-Florida-name placeholder pool (now inlined into dev_starting_point.sql)
  e2e_seed.sql                  Foundation for the E2E test suite (separate concern)

tests/
  e2e/                  Playwright tests + foundation (see tests/e2e/README.md)

scripts/                Node scripts (e2e-setup, e2e-verify-auth, e2e-verify-factories, etc)

docs/
  brainstorms/          Requirements docs from /ce:brainstorm sessions
  plans/                Implementation plans from /ce:plan sessions
  research/             Domain notes (Fargo formula, etc)
  events/               Notes for specific dev events / staging tests

CLAUDE.md               Working agreement / Memory Bank for AI-assisted work
TABLE_OF_CONTENTS.md    File index (kept in sync as files move)
```

---

## Tech stack

| Layer | Tools |
|---|---|
| Front end | React 19, TypeScript, Vite, Tailwind CSS, shadcn/ui (Radix primitives), TanStack Query, Lucide icons |
| Routing | React Router |
| Back end | Supabase (Postgres, GoTrue auth, Storage, Realtime) |
| Local dev | Supabase CLI (Docker) |
| Testing | Vitest (unit), Playwright (E2E) |
| Forms | React Hook Form |
| Dates | date-fns |

---

## Testing

- **Unit / integration tests:** Vitest. Files live under `src/__tests__/`. Run
  with `pnpm test` (watch) or `pnpm test:run` (one-shot).
- **End-to-end tests:** Playwright. The runbook for these is its own document
  at [`tests/e2e/README.md`](tests/e2e/README.md) — covers setup, run modes,
  the demo-recording workflow, and how to add new tests.

E2E and `dev_starting_point.sql` are intentionally separate fixtures:
`dev_starting_point.sql` is for hand-clicking through the app during dev;
the E2E foundation (built by `pnpm e2e:setup`) is for automated test runs.

---

## Documentation

- `docs/brainstorms/` — feature requirements docs (output of
  `/compound-engineering:ce-brainstorm`)
- `docs/plans/` — implementation plans (output of
  `/compound-engineering:ce-plan`)
- `docs/research/` — domain notes
- `CLAUDE.md` — working agreement for AI-assisted work in this repo
- `TABLE_OF_CONTENTS.md` — full file index, kept in sync as files move

---

## Conventions

- **Package manager:** pnpm only.
- **UI components:** shadcn/ui first. New buttons go through
  `@/components/ui/button`, not native `<button>`. Same for `Input`, `Label`,
  `Select`, `Card`, etc.
- **Date inputs:** use the `Calendar` component from `@/components/ui/calendar`;
  never plain `<input type="date">`. Use the timezone-safe helpers in
  `@/utils/formatters` (`parseLocalDate`, `formatLocalDate`) — never raw
  `new Date('2024-01-15')`.
- **No hardcoded `team_format` branching in new code.** The legacy
  `team_format` column is still NOT NULL on `leagues` so you'll see it being
  written, but new logic should key off the modular preferences fields
  (`handicap_type`, `lineup_size`, `max_roster_size`, `game_generation`).
  See `src/wizards/league-v2/presetMappings.ts` for the canonical mapping.
- **Branch-per-feature.** New work starts on a fresh branch off `main`.
