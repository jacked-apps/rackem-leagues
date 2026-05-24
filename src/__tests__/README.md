# Test directory conventions

This directory holds the project's test files. **Where you put a test
determines how vitest schedules it** — there's a `test.projects` split
in `vitest.config.ts` that auto-picks the right execution mode based on
the file's path.

## Directory layout

| Path | What goes here | Vitest project | Runtime |
|------|----------------|----------------|---------|
| Co-located with the source file (e.g., `src/components/Foo.test.tsx`) | Component / hook / utility unit tests that don't hit the database. | `unit` | parallel, happy-dom |
| `src/__tests__/unit/` | Standalone unit tests that don't fit next to a single source file (cross-cutting helpers, smoke checks). | `unit` | parallel, happy-dom |
| `src/__tests__/integration/` | Multi-component / multi-hook integration tests. Still mocked DB / supabase-js. | `unit` | parallel, happy-dom |
| `src/__tests__/database/` | **Anything that touches the real local Postgres** — migrations, triggers, RLS, SQL functions, supabase-js writes against the actual `pg` instance. | `db` | **sequential**, jsdom |

## The one rule that matters

> **If your test reads, writes, or asserts against the real local
> Postgres (running on `localhost:54322`), put the file under
> `src/__tests__/database/`.**

That's the only placement decision that affects test correctness. The
`db` project runs files **one at a time** (no race conditions on the
shared database) and uses **jsdom** (because happy-dom mangles
`Content-Type` on supabase-js writes — see `LIST_FOR_ED.md` #27 and
`memory/project_happy_dom_supabase_insert_limit.md`).

Everywhere else runs in parallel with happy-dom for speed.

## Why we don't just run everything sequentially

Parallelism saves time across hundreds of unit/integration tests. The
DB tests have to be sequential because they share one database — but
forcing everything sequential to "play it safe" would multiply CI time
unnecessarily as the test suite grows.

## Running tests

```sh
# Run everything — vitest auto-routes files to the right project.
pnpm test:run

# Run only DB tests.
pnpm test:run --project db

# Run only unit tests.
pnpm test:run --project unit

# Run a specific file (any project — vitest figures it out).
pnpm test:run src/__tests__/database/messaging-phase1-roster-triggers.rls.test.ts
```

You never need to pass `--no-file-parallelism` manually; the config
applies it automatically to the `db` project.

## Prerequisite for DB tests

Local Supabase must be running:

```sh
pnpm run db:start
```

Tests assume the dev seed has been applied. If a DB test fails with
`ECONNREFUSED 127.0.0.1:54322`, your local Supabase isn't running.

## When adding a new DB-touching test

1. Put the file under `src/__tests__/database/`.
2. Add `// @vitest-environment jsdom` as the **first line** if the test
   uses supabase-js (`.insert()`, `.update()`, etc.). The project
   default already sets jsdom, but the pragma is a load-bearing
   reminder for anyone reading the file in isolation.
3. Use the helpers in `src/test/dbTestUtils.ts` for raw SQL
   (`executeSql`) and Supabase client setup.
4. Be conservative about shared fixture data — every other DB test
   uses the same seed. If two tests pick "the earliest team with a
   captain," they will fight. See `LIST_FOR_ED.md` #27 for the
   sequential workaround already in place.
