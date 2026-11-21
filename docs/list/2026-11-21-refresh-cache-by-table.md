---
summary: Any save to a table refreshes every screen built from that table (no more old data after a change)
kind: task
added: 2026-11-21
checked: 2026-11-21
---

Ed's rule (2026-11-21): if I change something in a data set, every view of
that data set shows the new data. Today it often doesn't.

## Why it happens

- `src/api/client.ts` treats loaded data as fresh for 5 minutes and doesn't
  reload when a page opens (`staleTime: 5 min`, `refetchOnMount: false`).
- The cache only hears about saves made through TanStack's `useMutation`
  with an `onSuccess` refresh. Many screens call Supabase directly, so the
  cache never learns anything changed, and other pages show old data for up
  to 5 minutes.
- Example: after a schedule rebuild, Matchups showed the old schedule. Fixed
  for schedules only with `src/api/hooks/useInvalidateSeasonSchedule.ts`.

## The plan (strongest first)

1. **One mutation pipe that refreshes by table.** Every save goes through
   `useMutation` and declares the tables it touched (for example
   `meta: { tables: ['matches', 'teams'] }`). A single global
   `MutationCache` `onSuccess` in `src/api/client.ts` marks every cached query
   built from those tables stale. Query keys need a table tag for that to
   work. Add a CI check that fails when a component writes to Supabase
   directly (`.insert/.update/.upsert/.delete/.rpc` outside `src/api/`).
2. **Safety net: a less trusting cache.** Shorten the 5-minute window and/or
   reload on page open. Blunt (more loading), but it hides misses from #1.
3. **Realtime only where other people's changes matter** (match night:
   scores, standings). Supabase pushes "table changed" and we refresh. Not
   for every table (connections + setup cost).

Optimistic updates (show the expected result before the server confirms)
are a speed trick for small predictable edits, not the fix for this.

## Where to look

- `src/api/client.ts` (cache settings), `src/api/queryKeys.ts` (key shapes)
- `src/api/hooks/*Mutations.ts` (the pattern that works today)
- grep for `supabase.from(` / `.rpc(` writes in `src/` outside `src/api/`
- Overlaps the matches part of `docs/list/2026-11-04-consolidate-match-queries.md`
